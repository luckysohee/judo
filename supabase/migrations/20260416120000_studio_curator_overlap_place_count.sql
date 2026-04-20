-- 잔 아카이브: "다른 큐레이터와 같은 곳" = 내 추천(place) 중 다른 curator_places 행이 있는 place 개수
-- RLS로 타인 행을 못 읽을 수 있어 SECURITY DEFINER + auth.uid() 검증
-- RETURN(단일 SQL) 안에 PL/pgSQL 변수/unnest(변수) 를 쓰면 relation 오인(42P01) 가능 → studio_curator_overlap_places 와 동일한 순수 SQL CTE

CREATE OR REPLACE FUNCTION public.studio_curator_overlap_place_count(p_curator_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_curator_id IS DISTINCT FROM auth.uid() THEN
    RETURN 0;
  END IF;

  RETURN (
    WITH my_curator_ids AS (
      SELECT DISTINCT cid
      FROM (
        SELECT p_curator_id AS cid
        UNION ALL
        SELECT c.id
        FROM public.curators c
        WHERE c.user_id = p_curator_id
        LIMIT 1
      ) s
      WHERE cid IS NOT NULL
    ),
    my_places AS (
      SELECT DISTINCT cp.place_id
      FROM curator_places cp
      WHERE cp.place_id IS NOT NULL
        AND btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
        AND (cp.is_archived IS NOT TRUE)
    )
    SELECT COUNT(*)::integer
    FROM my_places mp
    WHERE EXISTS (
      SELECT 1
      FROM curator_places o
      WHERE o.place_id = mp.place_id
        AND btrim(o.curator_id::text) NOT IN (SELECT btrim(cid::text) FROM my_curator_ids)
        AND (o.is_archived IS NOT TRUE)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.studio_curator_overlap_place_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_curator_overlap_place_count(uuid) TO authenticated;

COMMENT ON FUNCTION public.studio_curator_overlap_place_count(uuid) IS
  '큐레이터 본인(auth): 내 추천 장소 중 다른 큐레이터도 추천한 place_id 개수 (잔 아카이브 겹침)';
