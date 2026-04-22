-- 홈 지도: bbox + 점수 상위 N + (선택) 상황 칩 키 필터 — 서버 단 1차 컷용 RPC 초안
-- 선행: places.tags 등 20260430310000_places_master_taxonomy_columns 적용 후 실행
-- 프론트 `fetchPlacesByBounds` / `mapDisplayedPlacesWithLegend` 대체·병행 시 클라이언트 부하 감소 목적

CREATE OR REPLACE FUNCTION public.map_places_in_bbox(
  south double precision,
  west double precision,
  north double precision,
  east double precision,
  p_limit integer DEFAULT 120,
  p_situation_key text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  lat double precision,
  lng double precision,
  map_score double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH b AS (
    SELECT
      LEAST(south, north) AS lat_min,
      GREATEST(south, north) AS lat_max,
      LEAST(west, east) AS lng_min,
      GREATEST(west, east) AS lng_max
  ),
  raw AS (
    SELECT
      p.id AS pid,
      p.name AS pname,
      p.category AS pcategory,
      p.lat::double precision AS plat,
      p.lng::double precision AS plng,
      (
        SELECT count(*)::double precision
        FROM curator_places cp
        WHERE cp.place_id = p.id
          AND (cp.is_archived IS NOT TRUE)
      ) AS curator_cnt,
      lower(
        coalesce(p.category, '') || ' ' || coalesce(array_to_string(p.tags, ' '), '')
      ) AS hay
    FROM places p
    CROSS JOIN b
    WHERE p.lat BETWEEN b.lat_min AND b.lat_max
      AND p.lng BETWEEN b.lng_min AND b.lng_max
  ),
  situation_pass AS (
    SELECT
      r.*,
      (
        r.curator_cnt * 2.0
        + 1.0
      ) AS sc
    FROM raw r
    WHERE
      p_situation_key IS NULL
      OR p_situation_key NOT IN ('after_party', 'group', 'date')
      OR (
        (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM user_saved_places usp
            INNER JOIN user_saved_place_folders usf
              ON usf.user_saved_place_id = usp.id
             AND usf.folder_key = p_situation_key
            WHERE usp.place_id = r.pid
              AND usp.user_id = auth.uid()
          )
        )
        OR (
          p_situation_key = 'after_party'
          AND (
            r.hay ~ '(2차|야간|늦게|포차|바|술집|안주|해산물|맥주|하이볼)'
            OR lower(coalesce(r.pcategory, '')) ~ '(주점|바|포장|민속|호프|술집|이자카야|와인|포차)'
          )
        )
        OR (
          p_situation_key = 'group'
          AND (
            r.hay ~ '(회식|단체|국물|고기|삼겹|밥|해장|곱창|찌개)'
            OR lower(coalesce(r.pcategory, '')) ~ '(한식|중식|일식|고기|곱창|삼겹|국밥|찌개|회)'
          )
        )
        OR (
          p_situation_key = 'date'
          AND (
            r.hay ~ '(데이트|분위기|로맨틱|와인|조용|야외|루프탑|뷰|인테리어)'
            OR lower(coalesce(r.pcategory, '')) ~ '(와인|바|카페|브루|다이닝|레스토랑|이탈리)'
          )
        )
      )
  )
  SELECT
    sp.pid,
    sp.pname,
    sp.pcategory,
    sp.plat,
    sp.plng,
    sp.sc
  FROM situation_pass sp
  ORDER BY sp.sc DESC, sp.pid
  LIMIT greatest(1, least(coalesce(p_limit, 120), 500));
$$;

COMMENT ON FUNCTION public.map_places_in_bbox(double precision, double precision, double precision, double precision, integer, text) IS
  '지도 bbox 안 장소: 큐레이터 연결 수 기반 score(가중치 튜닝 가능) + 선택적 상황키(after_party|group|date). '
  '상황: 본인 저장 폴더 일치 OR places.tags·category 휴리스틱. '
  '프론트 situationPlaceFilter.js 와 유사 규칙 — 완전 동일하진 않을 수 있음.';

GRANT EXECUTE ON FUNCTION public.map_places_in_bbox(double precision, double precision, double precision, double precision, integer, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
