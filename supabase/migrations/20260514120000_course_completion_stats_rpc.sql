-- 코스 완주 사회적 증거: 공개 집계만 반환(RLS 우회, 행 비노출).
-- completed_course_logs 재사용 · 단순 COUNT + 인덱스 (MVP).
-- 큐레이터 전체 집계 확장용: curator_id 인덱스.

CREATE INDEX IF NOT EXISTS idx_completed_course_logs_course_completed_at
  ON public.completed_course_logs (course_id, completed_at DESC)
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_completed_course_logs_curator_completed_at
  ON public.completed_course_logs (curator_id, completed_at DESC)
  WHERE curator_id IS NOT NULL;

-- 코스 1건: { completion_count, unique_user_count, recent_completion_count_7d }
CREATE OR REPLACE FUNCTION public.get_course_completion_stats(p_course_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'completion_count', COALESCE(COUNT(*), 0)::bigint,
    'unique_user_count', COALESCE(COUNT(DISTINCT user_id), 0)::bigint,
    'recent_completion_count_7d',
    COALESCE(
      COUNT(*) FILTER (
        WHERE completed_at >= (now() AT TIME ZONE 'utc') - interval '7 days'
      ),
      0
    )::bigint
  )
  FROM public.completed_course_logs
  WHERE course_id IS NOT DISTINCT FROM p_course_id;
$$;

-- 코스 다건: 한 번의 GROUP BY 스캔 (홈 레일 N+1 방지)
CREATE OR REPLACE FUNCTION public.get_course_completion_stats_batch(p_course_ids uuid[])
RETURNS TABLE (
  course_id uuid,
  completion_count bigint,
  unique_user_count bigint,
  recent_completion_count_7d bigint
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
      COUNT(*)::bigint AS completion_count,
      COUNT(DISTINCT l.user_id)::bigint AS unique_user_count,
      COUNT(*) FILTER (
        WHERE l.completed_at >= (now() AT TIME ZONE 'utc') - interval '7 days'
      )::bigint AS recent_completion_count_7d
    FROM public.completed_course_logs l
    WHERE l.course_id = ANY (SELECT w.course_id FROM wanted w)
    GROUP BY l.course_id
  )
  SELECT
    w.course_id,
    COALESCE(a.completion_count, 0)::bigint,
    COALESCE(a.unique_user_count, 0)::bigint,
    COALESCE(a.recent_completion_count_7d, 0)::bigint
  FROM wanted w
  LEFT JOIN agg a ON a.course_id = w.course_id;
$$;

-- 큐레이터 프로필·성장 지표용 (UI는 후속; 구조만)
CREATE OR REPLACE FUNCTION public.get_curator_completion_stats(p_curator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'completion_count', COALESCE(COUNT(*), 0)::bigint,
    'unique_user_count', COALESCE(COUNT(DISTINCT user_id), 0)::bigint,
    'recent_completion_count_7d',
    COALESCE(
      COUNT(*) FILTER (
        WHERE completed_at >= (now() AT TIME ZONE 'utc') - interval '7 days'
      ),
      0
    )::bigint
  )
  FROM public.completed_course_logs
  WHERE curator_id IS NOT DISTINCT FROM p_curator_id;
$$;

REVOKE ALL ON FUNCTION public.get_course_completion_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_completion_stats(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_course_completion_stats(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_course_completion_stats_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_completion_stats_batch(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_course_completion_stats_batch(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.get_curator_completion_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_curator_completion_stats(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_curator_completion_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_course_completion_stats(uuid) IS
  '공개: 코스별 완주 건수·고유 유저·최근 7일 완주 건수 (completed_course_logs 집계).';

COMMENT ON FUNCTION public.get_course_completion_stats_batch(uuid[]) IS
  '공개: 여러 코스에 대한 완주 집계 한 번에 조회.';

COMMENT ON FUNCTION public.get_curator_completion_stats(uuid) IS
  '공개: 큐레이터가 만든 코스에 대한 완주 집계(로그의 curator_id 기준).';

NOTIFY pgrst, 'reload schema';
