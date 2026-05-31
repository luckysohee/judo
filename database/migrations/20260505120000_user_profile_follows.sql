-- User–user follow graph: follower_id → following_id (auth.users).
-- Replaces implicit curator-only rows in user_follows / curator_follows for new writes; backfilled for reads.

CREATE TABLE IF NOT EXISTS public.user_profile_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT (timezone('utc', now())),
  -- 팔로우 당사자(following_id)가 스튜디오에서 읽음 처리 (토스트 알림용)
  is_read boolean NOT NULL DEFAULT true,
  CONSTRAINT user_profile_follows_no_self CHECK (follower_id <> following_id),
  CONSTRAINT user_profile_follows_follower_following_uniq UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_follows_follower
  ON public.user_profile_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_follows_following
  ON public.user_profile_follows (following_id);

ALTER TABLE public.user_profile_follows
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT true;

COMMENT ON TABLE public.user_profile_follows IS
  'Social follow: follower_id follows following_id (both auth.users).';

-- Backfill from user_follows + curators
INSERT INTO public.user_profile_follows (follower_id, following_id, created_at, is_read)
SELECT DISTINCT ON (uf.user_id, c.user_id)
  uf.user_id,
  c.user_id,
  uf.created_at,
  true
FROM public.user_follows uf
INNER JOIN public.curators c
  ON btrim(uf.curator_id::text) = btrim(c.id::text)
WHERE uf.user_id IS NOT NULL
  AND c.user_id IS NOT NULL
ORDER BY uf.user_id, c.user_id, uf.created_at DESC
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- Backfill from curator_follows if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'curator_follows'
  ) THEN
    INSERT INTO public.user_profile_follows (follower_id, following_id, created_at, is_read)
    SELECT DISTINCT ON (cf.user_id, c.user_id)
      cf.user_id,
      c.user_id,
      cf.created_at,
      true
    FROM public.curator_follows cf
    INNER JOIN public.curators c
      ON btrim(cf.curator_id::text) = btrim(c.id::text)
    WHERE cf.user_id IS NOT NULL
      AND c.user_id IS NOT NULL
    ORDER BY cf.user_id, c.user_id, cf.created_at DESC
    ON CONFLICT (follower_id, following_id) DO NOTHING;
  END IF;
END;
$$;

ALTER TABLE public.user_profile_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profile_follows_select_auth" ON public.user_profile_follows;
CREATE POLICY "user_profile_follows_select_auth"
  ON public.user_profile_follows FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_profile_follows_insert_own" ON public.user_profile_follows;
CREATE POLICY "user_profile_follows_insert_own"
  ON public.user_profile_follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "user_profile_follows_delete_own" ON public.user_profile_follows;
CREATE POLICY "user_profile_follows_delete_own"
  ON public.user_profile_follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

DROP POLICY IF EXISTS "user_profile_follows_update_followee_read" ON public.user_profile_follows;
CREATE POLICY "user_profile_follows_update_followee_read"
  ON public.user_profile_follows FOR UPDATE
  TO authenticated
  USING (following_id = auth.uid())
  WITH CHECK (following_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: follow / unfollow / query
-- ---------------------------------------------------------------------------
-- OUT/RETURNS TABLE 시그니처가 기존과 다르면 CREATE OR REPLACE만으로는 42P13 — 먼저 DROP
DROP FUNCTION IF EXISTS public.studio_following_previews(uuid);
DROP FUNCTION IF EXISTS public.studio_follower_previews_by_following(uuid);
DROP FUNCTION IF EXISTS public.studio_follower_previews(uuid);
DROP FUNCTION IF EXISTS public.mutual_follow_with(uuid);
DROP FUNCTION IF EXISTS public.user_follow_counts(uuid);
DROP FUNCTION IF EXISTS public.is_following_user(uuid);
DROP FUNCTION IF EXISTS public.unfollow_user(uuid);
DROP FUNCTION IF EXISTS public.follow_user(uuid);

CREATE OR REPLACE FUNCTION public.follow_user(p_following_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_following_id IS NULL OR p_following_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid target';
  END IF;
  INSERT INTO public.user_profile_follows (follower_id, following_id, is_read)
  VALUES (auth.uid(), p_following_id, false)
  ON CONFLICT (follower_id, following_id) DO NOTHING;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.unfollow_user(p_following_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.user_profile_follows
  WHERE follower_id = auth.uid()
    AND following_id = p_following_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.is_following_user(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profile_follows f
    WHERE f.follower_id = auth.uid()
      AND f.following_id = p_target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_follow_counts(p_user_id uuid)
RETURNS TABLE (followers_count bigint, following_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::bigint FROM public.user_profile_follows f WHERE f.following_id = p_user_id),
    (SELECT COUNT(*)::bigint FROM public.user_profile_follows f WHERE f.follower_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.mutual_follow_with(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profile_follows f
    WHERE f.follower_id = auth.uid()
      AND f.following_id = p_other_user_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.user_profile_follows f
    WHERE f.follower_id = p_other_user_id
      AND f.following_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.follow_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unfollow_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_following_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_follow_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mutual_follow_with(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.follow_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_following_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_follow_counts(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutual_follow_with(uuid) TO authenticated;

COMMENT ON FUNCTION public.follow_user(uuid) IS 'Current user follows target auth user.';
COMMENT ON FUNCTION public.user_follow_counts(uuid) IS 'Followers and following counts for a profile user.';

-- ---------------------------------------------------------------------------
-- Studio: follower previews — user_profile_follows + profiles/curators
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.studio_follower_previews(p_curator_id uuid)
RETURNS TABLE (
  user_id uuid,
  created_at timestamptz,
  display_nick text,
  handle_raw text,
  avatar_url text,
  is_curator boolean,
  curator_grade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    uf.follower_id AS user_id,
    uf.created_at,
    NULLIF(
      TRIM(
        COALESCE(
          NULLIF(TRIM(COALESCE(c.display_name, '')), ''),
          NULLIF(TRIM(COALESCE(c.name, '')), ''),
          NULLIF(TRIM(COALESCE(p.display_name, '')), '')
        )
      ),
      ''
    ) AS display_nick,
    NULLIF(
      LOWER(
        REGEXP_REPLACE(
          TRIM(COALESCE(c.username, p.username, '')),
          '^@+',
          ''
        )
      ),
      ''
    ) AS handle_raw,
    NULLIF(
      TRIM(COALESCE(c.avatar_url, p.avatar_url, '')),
      ''
    ) AS avatar_url,
    (c.user_id IS NOT NULL) AS is_curator,
    c.grade::text AS curator_grade
  FROM public.user_profile_follows uf
  INNER JOIN public.curators target ON btrim(target.id::text) = btrim(p_curator_id::text)
    AND uf.following_id = target.user_id
  LEFT JOIN public.profiles p ON p.id = uf.follower_id
  LEFT JOIN public.curators c ON c.user_id = uf.follower_id
  WHERE EXISTS (
    SELECT 1
    FROM public.curators owner
    WHERE btrim(owner.id::text) = btrim(p_curator_id::text)
      AND owner.user_id = auth.uid()
  )
  ORDER BY uf.created_at DESC
  LIMIT 200;
$$;

-- 내 프로필을 팔로우한 사람 (큐레이터 행 없이 user_id만 있어도 조회) — p_following_user_id = auth.uid()
CREATE OR REPLACE FUNCTION public.studio_follower_previews_by_following(p_following_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  created_at timestamptz,
  display_nick text,
  handle_raw text,
  avatar_url text,
  is_curator boolean,
  curator_grade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    uf.follower_id AS user_id,
    uf.created_at,
    NULLIF(
      TRIM(
        COALESCE(
          NULLIF(TRIM(COALESCE(c.display_name, '')), ''),
          NULLIF(TRIM(COALESCE(c.name, '')), ''),
          NULLIF(TRIM(COALESCE(p.display_name, '')), '')
        )
      ),
      ''
    ) AS display_nick,
    NULLIF(
      LOWER(
        REGEXP_REPLACE(
          TRIM(COALESCE(c.username, p.username, '')),
          '^@+',
          ''
        )
      ),
      ''
    ) AS handle_raw,
    NULLIF(
      TRIM(COALESCE(c.avatar_url, p.avatar_url, '')),
      ''
    ) AS avatar_url,
    (c.user_id IS NOT NULL) AS is_curator,
    c.grade::text AS curator_grade
  FROM public.user_profile_follows uf
  LEFT JOIN public.profiles p ON p.id = uf.follower_id
  LEFT JOIN public.curators c ON c.user_id = uf.follower_id
  WHERE uf.following_id = p_following_user_id
    AND p_following_user_id = auth.uid()
  ORDER BY uf.created_at DESC
  LIMIT 200;
$$;

-- Following list for any user (picks tab): curators + plain profiles
CREATE OR REPLACE FUNCTION public.studio_following_previews(p_user_id uuid)
RETURNS TABLE (
  curator_id_raw text,
  created_at timestamptz,
  curator_user_id uuid,
  following_user_id uuid,
  display_nick text,
  handle_raw text,
  avatar_url text,
  curator_grade text,
  is_curator boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT f.following_id, f.created_at
    FROM public.user_profile_follows f
    WHERE f.follower_id = p_user_id
  ),
  dedup AS (
    SELECT DISTINCT ON (b.following_id)
      b.following_id,
      b.created_at
    FROM base b
    ORDER BY b.following_id, b.created_at DESC
  )
  SELECT
    btrim(cu.id::text) AS curator_id_raw,
    d.created_at,
    cu.user_id AS curator_user_id,
    d.following_id AS following_user_id,
    NULLIF(
      TRIM(
        COALESCE(
          NULLIF(TRIM(COALESCE(cu.display_name, '')), ''),
          NULLIF(TRIM(COALESCE(cu.name, '')), ''),
          NULLIF(TRIM(COALESCE(pr.display_name, '')), '')
        )
      ),
      ''
    ) AS display_nick,
    NULLIF(
      LOWER(REGEXP_REPLACE(TRIM(COALESCE(cu.username, pr.username, '')), '^@+', '')),
      ''
    ) AS handle_raw,
    NULLIF(TRIM(COALESCE(cu.avatar_url, pr.avatar_url, '')), '') AS avatar_url,
    cu.grade::text AS curator_grade,
    (cu.id IS NOT NULL) AS is_curator
  FROM dedup d
  LEFT JOIN public.curators cu ON cu.user_id = d.following_id
  LEFT JOIN public.profiles pr ON pr.id = d.following_id AND cu.id IS NULL
  WHERE p_user_id IS NOT DISTINCT FROM auth.uid()
  ORDER BY d.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.studio_follower_previews(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.studio_follower_previews_by_following(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.studio_following_previews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_follower_previews(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.studio_follower_previews_by_following(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.studio_following_previews(uuid) TO authenticated;

COMMENT ON FUNCTION public.studio_following_previews(uuid) IS
  'Picks tab: users this follower_id follows; curator row when applicable else profile.';

NOTIFY pgrst, 'reload schema';
