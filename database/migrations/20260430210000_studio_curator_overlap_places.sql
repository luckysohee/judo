-- 잔 아카이브: 겹친 place 목록 + 다른 큐레이터 (한글 등급 + @핸들; curator_id=user_id 또는 id 로 조인)
-- RETURNS 변경 시 기존 함수 제거 후 재생성

DROP FUNCTION IF EXISTS public.studio_curator_overlap_places(uuid);

CREATE FUNCTION public.studio_curator_overlap_places(p_curator_id uuid)
RETURNS TABLE(
  place_id uuid,
  place_name text,
  place_address text,
  other_curator_handles text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_curator_id IS DISTINCT FROM auth.uid() THEN
    RETURN;
  END IF;

  RETURN QUERY
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
    SELECT DISTINCT cp.place_id AS pid
    FROM curator_places cp
    WHERE cp.place_id IS NOT NULL
      AND btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
      AND (cp.is_archived IS NOT TRUE)
  ),
  overlap_place_ids AS (
    SELECT DISTINCT mp.pid
    FROM my_places mp
    WHERE EXISTS (
      SELECT 1
      FROM curator_places o
      WHERE o.place_id = mp.pid
        AND o.curator_id NOT IN (SELECT cid FROM my_curator_ids)
        AND (o.is_archived IS NOT TRUE)
    )
  )
  SELECT
    p.id,
    COALESCE(NULLIF(trim(p.name), ''), '(이름 없음)')::text,
    COALESCE(NULLIF(trim(p.address), ''), '')::text,
    (
      SELECT string_agg(sub.line, ', ' ORDER BY sub.gr DESC, sub.handle_key)
      FROM (
        SELECT DISTINCT ON (r.curator_id)
          (r.grade_ko || ' ' || r.handle_str) AS line,
          public.grade_rank(r.grade_raw) AS gr,
          r.handle_str AS handle_key
        FROM (
          SELECT
            o.curator_id,
            CASE lower(trim(COALESCE(cu.grade, 'bronze')))
              WHEN 'diamond' THEN '다이아몬드'
              WHEN 'platinum' THEN '플래티넘'
              WHEN 'gold' THEN '골드'
              WHEN 'silver' THEN '실버'
              WHEN 'bronze' THEN '브론즈'
              ELSE initcap(lower(trim(COALESCE(cu.grade, 'bronze'))))
            END AS grade_ko,
            COALESCE(cu.grade, 'bronze') AS grade_raw,
            CASE
              WHEN NULLIF(trim(cu.username), '') IS NOT NULL THEN
                '@' || trim(cu.username)
              WHEN NULLIF(trim(cu.slug), '') IS NOT NULL THEN
                '@' || trim(cu.slug)
              WHEN NULLIF(trim(cu.display_name), '') IS NOT NULL THEN
                trim(cu.display_name)
              ELSE
                'uid:' || LEFT(o.curator_id::text, 8)
            END AS handle_str
          FROM curator_places o
          LEFT JOIN LATERAL (
            SELECT c.*
            FROM public.curators c
            WHERE c.user_id = o.curator_id OR c.id = o.curator_id
            ORDER BY CASE WHEN c.user_id = o.curator_id THEN 0 ELSE 1 END
            LIMIT 1
          ) cu ON true
          WHERE o.place_id = p.id
            AND o.curator_id NOT IN (SELECT cid FROM my_curator_ids)
            AND (o.is_archived IS NOT TRUE)
        ) r
        ORDER BY r.curator_id
      ) sub
      WHERE sub.line IS NOT NULL AND trim(sub.line) <> ''
    )::text
  FROM public.places p
  INNER JOIN overlap_place_ids x ON x.pid = p.id
  ORDER BY p.name NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.studio_curator_overlap_places(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_curator_overlap_places(uuid) TO authenticated;

COMMENT ON FUNCTION public.studio_curator_overlap_places(uuid) IS
  '본인(auth): 겹친 추천 장소 + 다른 큐레이터(한글 등급+핸들, curator user_id/id 조인, 등급 높은 순)';

NOTIFY pgrst, 'reload schema';
