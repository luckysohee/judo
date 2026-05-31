-- 지도 검색 스코어링 보조: place_picks 가중 합(일반 1·큐레이터 4) + check_ins 건수(한잔, 키는 text place_id)
-- 한 번의 RPC로 배치 조회. RLS는 기존 place_picks / check_ins SELECT 정책을 따름.

CREATE OR REPLACE FUNCTION public.get_search_social_boost_batch(
  p_place_uuids uuid[],
  p_hanjan_place_keys text[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
  SELECT jsonb_build_object(
    'picks',
    COALESCE(
      (
        SELECT jsonb_object_agg(sub.place_id::text, sub.w)
        FROM (
          SELECT
            pp.place_id,
            SUM(CASE WHEN pp.is_curator THEN 4 ELSE 1 END)::int AS w
          FROM public.place_picks pp
          WHERE
            p_place_uuids IS NOT NULL
            AND cardinality(p_place_uuids) > 0
            AND pp.place_id = ANY(p_place_uuids)
          GROUP BY pp.place_id
        ) sub
      ),
      '{}'::jsonb
    ),
    'hanjan',
    COALESCE(
      (
        SELECT jsonb_object_agg(sub.k, sub.c)
        FROM (
          SELECT
            btrim(ci.place_id) AS k,
            COUNT(*)::int AS c
          FROM public.check_ins ci
          WHERE
            p_hanjan_place_keys IS NOT NULL
            AND cardinality(p_hanjan_place_keys) > 0
            AND btrim(ci.place_id) IN (
              SELECT btrim(x)
              FROM unnest(p_hanjan_place_keys) AS u(x)
            )
          GROUP BY btrim(ci.place_id)
        ) sub
      ),
      '{}'::jsonb
    )
  );
$func$;

COMMENT ON FUNCTION public.get_search_social_boost_batch(uuid[], text[]) IS
  '검색 후보 배치용: place_picks 가중 합 + check_ins 건수. 클라이언트에서 log·cap 보정.';

REVOKE ALL ON FUNCTION public.get_search_social_boost_batch(uuid[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_search_social_boost_batch(uuid[], text[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
