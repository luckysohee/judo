-- 스튜디오 picks RPC (Supabase 동일: supabase/migrations/20260423160000_studio_following_previews_rpc.sql)

CREATE OR REPLACE FUNCTION public.studio_following_previews(p_user_id uuid)
RETURNS TABLE (
  curator_id_raw text,
  created_at timestamptz,
  curator_user_id uuid,
  display_nick text,
  handle_raw text,
  avatar_url text,
  curator_grade text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH src AS (
    SELECT f.curator_id, f.created_at
    FROM public.user_follows f
    WHERE f.user_id = p_user_id
  ),
  dedup AS (
    SELECT DISTINCT ON (btrim(s.curator_id::text))
      btrim(s.curator_id::text) AS ck,
      s.created_at
    FROM src s
    WHERE s.curator_id IS NOT NULL AND btrim(s.curator_id::text) <> ''
    ORDER BY btrim(s.curator_id::text), s.created_at DESC
  )
  SELECT
    d.ck AS curator_id_raw,
    d.created_at,
    c.user_id AS curator_user_id,
    NULLIF(
      TRIM(
        COALESCE(
          NULLIF(TRIM(COALESCE(c.display_name, '')), ''),
          NULLIF(TRIM(COALESCE(c.name, '')), '')
        )
      ),
      ''
    ) AS display_nick,
    NULLIF(
      LOWER(
        REGEXP_REPLACE(
          TRIM(COALESCE(c.username, '')),
          '^@+',
          ''
        )
      ),
      ''
    ) AS handle_raw,
    NULLIF(TRIM(COALESCE(c.avatar_url, '')), '') AS avatar_url,
    c.grade::text AS curator_grade
  FROM dedup d
  LEFT JOIN LATERAL (
    SELECT cu.id, cu.user_id, cu.display_name, cu.name, cu.username, cu.slug,
           cu.avatar_url, cu.grade
    FROM public.curators cu
    WHERE btrim(d.ck) = btrim(cu.id::text)
       OR btrim(d.ck) = btrim(cu.user_id::text)
       OR (
         btrim(COALESCE(cu.username, '')) <> ''
         AND lower(btrim(d.ck)) = lower(btrim(cu.username))
       )
       OR (
         cu.slug IS NOT NULL
         AND btrim(COALESCE(cu.slug::text, '')) <> ''
         AND lower(btrim(d.ck)) = lower(btrim(cu.slug::text))
       )
    LIMIT 1
  ) c ON TRUE
  WHERE p_user_id IS NOT DISTINCT FROM auth.uid()
  ORDER BY d.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.studio_following_previews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_following_previews(uuid) TO authenticated;
