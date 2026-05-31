-- 큐레이터 아카이브/영향력: get_curator_completion_stats 확장 (하위 호환 키 유지)
-- + published_course_count, top_course(공개 코스 중 완주 최다)

CREATE OR REPLACE FUNCTION public.get_curator_completion_stats(p_curator_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH logs AS (
  SELECT user_id, course_id, completed_at
  FROM public.completed_course_logs
  WHERE curator_id IS NOT DISTINCT FROM p_curator_id
),
agg AS (
  SELECT
    COUNT(*)::bigint AS total_completion_count,
    COUNT(DISTINCT user_id)::bigint AS unique_completed_users,
    COUNT(*) FILTER (
      WHERE completed_at >= (now() AT TIME ZONE 'utc') - interval '7 days'
    )::bigint AS recent_completion_count_7d
  FROM logs
),
pub_count AS (
  SELECT COUNT(*)::bigint AS published_course_count
  FROM public.curator_courses c
  WHERE c.curator_id IS NOT DISTINCT FROM p_curator_id
    AND c.status = 'published'
    AND c.is_public = true
),
per_course AS (
  SELECT l.course_id, COUNT(*)::bigint AS cnt
  FROM logs l
  INNER JOIN public.curator_courses c
    ON c.id = l.course_id
   AND c.curator_id IS NOT DISTINCT FROM p_curator_id
   AND c.status = 'published'
   AND c.is_public = true
  WHERE l.course_id IS NOT NULL
  GROUP BY l.course_id
),
winner AS (
  SELECT pc.course_id, pc.cnt, c.title
  FROM per_course pc
  INNER JOIN public.curator_courses c ON c.id = pc.course_id
  ORDER BY pc.cnt DESC, pc.course_id ASC
  LIMIT 1
)
SELECT jsonb_build_object(
  'completion_count', (SELECT total_completion_count FROM agg),
  'unique_user_count', (SELECT unique_completed_users FROM agg),
  'recent_completion_count_7d', (SELECT recent_completion_count_7d FROM agg),
  'total_completion_count', (SELECT total_completion_count FROM agg),
  'unique_completed_users', (SELECT unique_completed_users FROM agg),
  'published_course_count', COALESCE((SELECT published_course_count FROM pub_count), 0),
  'top_course',
  CASE
    WHEN (SELECT w.course_id FROM winner w) IS NULL THEN NULL
    ELSE jsonb_build_object(
      'course_id', (SELECT w.course_id FROM winner w),
      'title',
      COALESCE(
        NULLIF(btrim(COALESCE((SELECT w.title FROM winner w), '')), ''),
        '제목 없음'
      ),
      'completion_count', (SELECT w.cnt FROM winner w)
    )
  END
)
FROM agg
CROSS JOIN pub_count;
$$;

COMMENT ON FUNCTION public.get_curator_completion_stats(uuid) IS
  '공개: 큐레이터 완주 집계 + 공개 코스 수 + 완주 최다 공개 코스(top_course). 하위 호환: completion_count 등.';

NOTIFY pgrst, 'reload schema';
