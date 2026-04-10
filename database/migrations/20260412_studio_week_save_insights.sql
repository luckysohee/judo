-- 스튜디오 성장 추이: 큐레이터 본인 추천(place)에 대한 이번 주 저장 수 집계
-- RLS로 user_saved_places 전체를 볼 수 없으므로 SECURITY DEFINER + auth.uid() 검증

CREATE OR REPLACE FUNCTION public.studio_week_save_insights(p_curator_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_curator_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object(
      'top_place_name', NULL,
      'top_save_count', 0,
      'week_total_saves', 0
    );
  END IF;

  RETURN (
    WITH week_start AS (
      SELECT date_trunc('week', (now() AT TIME ZONE 'utc')) AT TIME ZONE 'utc' AS t
    ),
    my_places AS (
      SELECT cp.place_id
      FROM curator_places cp
      WHERE cp.curator_id = p_curator_id
        AND (cp.is_archived IS NOT TRUE)
    ),
    saves AS (
      SELECT usp.place_id, COUNT(*)::bigint AS c
      FROM user_saved_places usp
      CROSS JOIN week_start w
      WHERE usp.place_id IN (SELECT place_id FROM my_places)
        AND usp.created_at >= w.t
      GROUP BY usp.place_id
    ),
    top_one AS (
      SELECT COALESCE(NULLIF(trim(p.name), ''), NULLIF(trim(p.address), ''), '이름 없음') AS pname, s.c
      FROM saves s
      JOIN places p ON p.id = s.place_id
      ORDER BY s.c DESC, pname ASC NULLS LAST
      LIMIT 1
    )
    SELECT json_build_object(
      'top_place_name', (SELECT pname FROM top_one),
      'top_save_count', COALESCE((SELECT c FROM top_one), 0),
      'week_total_saves', COALESCE((SELECT SUM(c) FROM saves), 0)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.studio_week_save_insights(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_week_save_insights(uuid) TO authenticated;

COMMENT ON FUNCTION public.studio_week_save_insights(uuid) IS
  '큐레이터 본인(auth)의 추천 장소에 달린 이번 주(UTC 주 시작) user_saved_places 건수 합계 및 최다 장소';
