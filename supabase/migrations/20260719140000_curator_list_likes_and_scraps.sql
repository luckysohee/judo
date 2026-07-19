-- 맛집첩 좋아요·스크랩(북마크). 코스 likes/bookmarks 와 대칭.

CREATE TABLE IF NOT EXISTS public.curator_list_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.curator_lists (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_list_likes_user_list_unique UNIQUE (user_id, list_id)
);

CREATE INDEX IF NOT EXISTS idx_curator_list_likes_list_created
  ON public.curator_list_likes (list_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_curator_list_likes_user_created
  ON public.curator_list_likes (user_id, created_at DESC);

COMMENT ON TABLE public.curator_list_likes IS
  '공개 맛집첩 좋아요. 집계는 SECURITY DEFINER RPC.';

ALTER TABLE public.curator_list_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curator_list_likes_select_own" ON public.curator_list_likes;
CREATE POLICY "curator_list_likes_select_own"
  ON public.curator_list_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "curator_list_likes_insert_public_list" ON public.curator_list_likes;
CREATE POLICY "curator_list_likes_insert_public_list"
  ON public.curator_list_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.curator_lists cl
      WHERE cl.id = list_id
        AND cl.status = 'published'
        AND cl.is_public = true
    )
  );

DROP POLICY IF EXISTS "curator_list_likes_delete_own" ON public.curator_list_likes;
CREATE POLICY "curator_list_likes_delete_own"
  ON public.curator_list_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.curator_list_likes FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.curator_list_likes TO authenticated;

CREATE OR REPLACE FUNCTION public.get_list_like_stats(p_list_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'like_count', COALESCE(COUNT(*), 0)::bigint,
    'recent_like_count_7d',
    COALESCE(
      COUNT(*) FILTER (
        WHERE created_at >= (now() AT TIME ZONE 'utc') - interval '7 days'
      ),
      0
    )::bigint
  )
  FROM public.curator_list_likes
  WHERE list_id IS NOT DISTINCT FROM p_list_id;
$$;

REVOKE ALL ON FUNCTION public.get_list_like_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_list_like_stats(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_list_like_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_list_like_stats(uuid) IS
  '공개: 맛집첩 좋아요 수·최근 7일 좋아요 수.';

CREATE TABLE IF NOT EXISTS public.curator_list_scraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.curator_lists (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_list_scraps_user_list_unique UNIQUE (user_id, list_id)
);

CREATE INDEX IF NOT EXISTS idx_curator_list_scraps_user_created
  ON public.curator_list_scraps (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_curator_list_scraps_list_created
  ON public.curator_list_scraps (list_id, created_at DESC);

COMMENT ON TABLE public.curator_list_scraps IS
  '공개 맛집첩 스크랩(북마크). 원본 복제·편집 없음.';

ALTER TABLE public.curator_list_scraps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curator_list_scraps_select_own" ON public.curator_list_scraps;
CREATE POLICY "curator_list_scraps_select_own"
  ON public.curator_list_scraps FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "curator_list_scraps_insert_public_list" ON public.curator_list_scraps;
CREATE POLICY "curator_list_scraps_insert_public_list"
  ON public.curator_list_scraps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.curator_lists cl
      WHERE cl.id = list_id
        AND cl.status = 'published'
        AND cl.is_public = true
    )
  );

DROP POLICY IF EXISTS "curator_list_scraps_delete_own" ON public.curator_list_scraps;
CREATE POLICY "curator_list_scraps_delete_own"
  ON public.curator_list_scraps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.curator_list_scraps FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.curator_list_scraps TO authenticated;

NOTIFY pgrst, 'reload schema';
