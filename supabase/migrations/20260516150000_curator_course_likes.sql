-- 잔 코스 좋아요 (완주와 별도 지표)

CREATE TABLE IF NOT EXISTS public.curator_course_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.curator_courses (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_course_likes_user_course_unique UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_curator_course_likes_course_created
  ON public.curator_course_likes (course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_curator_course_likes_user_created
  ON public.curator_course_likes (user_id, created_at DESC);

COMMENT ON TABLE public.curator_course_likes IS
  '공개 잔 코스에 대한 사용자 좋아요. 집계는 SECURITY DEFINER RPC.';

ALTER TABLE public.curator_course_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curator_course_likes_select_own" ON public.curator_course_likes;
CREATE POLICY "curator_course_likes_select_own"
  ON public.curator_course_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "curator_course_likes_insert_public_course" ON public.curator_course_likes;
CREATE POLICY "curator_course_likes_insert_public_course"
  ON public.curator_course_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.curator_courses c
      WHERE c.id = course_id
        AND c.status = 'published'
        AND c.is_public = true
    )
  );

DROP POLICY IF EXISTS "curator_course_likes_delete_own" ON public.curator_course_likes;
CREATE POLICY "curator_course_likes_delete_own"
  ON public.curator_course_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.curator_course_likes FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.curator_course_likes TO authenticated;

CREATE OR REPLACE FUNCTION public.get_course_like_stats(p_course_id uuid)
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
  FROM public.curator_course_likes
  WHERE course_id IS NOT DISTINCT FROM p_course_id;
$$;

CREATE OR REPLACE FUNCTION public.get_course_like_stats_batch(p_course_ids uuid[])
RETURNS TABLE (
  course_id uuid,
  like_count bigint,
  recent_like_count_7d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wanted AS (
    SELECT DISTINCT x AS course_id
    FROM unnest(COALESCE(p_course_ids, ARRAY[]::uuid[])) AS t(x)
  ),
  agg AS (
    SELECT
      l.course_id,
      COUNT(*)::bigint AS like_count,
      COUNT(*) FILTER (
        WHERE l.created_at >= (now() AT TIME ZONE 'utc') - interval '7 days'
      )::bigint AS recent_like_count_7d
    FROM public.curator_course_likes l
    WHERE l.course_id = ANY (SELECT w.course_id FROM wanted w)
    GROUP BY l.course_id
  )
  SELECT
    w.course_id,
    COALESCE(a.like_count, 0)::bigint,
    COALESCE(a.recent_like_count_7d, 0)::bigint
  FROM wanted w
  LEFT JOIN agg a ON a.course_id = w.course_id;
$$;

REVOKE ALL ON FUNCTION public.get_course_like_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_like_stats(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_course_like_stats(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_course_like_stats_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_like_stats_batch(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_course_like_stats_batch(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_course_like_stats(uuid) IS
  '공개: 코스별 좋아요 수·최근 7일 좋아요 수.';

COMMENT ON FUNCTION public.get_course_like_stats_batch(uuid[]) IS
  '공개: 여러 코스 좋아요 집계 한 번에 조회.';

NOTIFY pgrst, 'reload schema';
