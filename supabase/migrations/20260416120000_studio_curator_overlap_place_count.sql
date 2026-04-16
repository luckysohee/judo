-- 잔 아카이브: "다른 큐레이터와 같은 곳" = 내 추천(place) 중 다른 curator_places 행이 있는 place 개수
-- RLS로 타인 행을 못 읽을 수 있어 SECURITY DEFINER + auth.uid() 검증

CREATE OR REPLACE FUNCTION public.studio_curator_overlap_place_count(p_curator_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_curator_row_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_curator_id IS DISTINCT FROM auth.uid() THEN
    RETURN 0;
  END IF;

  SELECT c.id
  INTO v_curator_row_id
  FROM curators c
  WHERE c.user_id = p_curator_id
  LIMIT 1;

  RETURN (
    WITH my_curator_ids AS (
      SELECT DISTINCT x AS cid
      FROM unnest(
        ARRAY[
          p_curator_id,
          v_curator_row_id
        ]::uuid[]
      ) AS t(x)
      WHERE x IS NOT NULL
    ),
    my_places AS (
      SELECT DISTINCT cp.place_id
      FROM curator_places cp
      WHERE cp.place_id IS NOT NULL
        AND cp.curator_id IN (SELECT cid FROM my_curator_ids)
        AND (cp.is_archived IS NOT TRUE)
    )
    SELECT COUNT(*)::integer
    FROM my_places mp
    WHERE EXISTS (
      SELECT 1
      FROM curator_places o
      WHERE o.place_id = mp.place_id
        AND o.curator_id NOT IN (SELECT cid FROM my_curator_ids)
        AND (o.is_archived IS NOT TRUE)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.studio_curator_overlap_place_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_curator_overlap_place_count(uuid) TO authenticated;

COMMENT ON FUNCTION public.studio_curator_overlap_place_count(uuid) IS
  '큐레이터 본인(auth): 내 추천 장소 중 다른 큐레이터도 추천한 place_id 개수 (잔 아카이브 겹침)';
