-- 밀도 그리드 셀 적응형 크기 — 숫자 1~2만 보이던 문제 수정

CREATE OR REPLACE FUNCTION public.get_place_density_in_bounds(
  south double precision,
  west double precision,
  north double precision,
  east double precision,
  p_level integer DEFAULT 8,
  p_cell_size double precision DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lat_min double precision;
  lat_max double precision;
  lng_min double precision;
  lng_max double precision;
  lat_span double precision;
  lng_span double precision;
  span double precision;
  cell double precision;
  lv int := greatest(1, least(coalesce(p_level, 8), 14));
  target_side double precision;
  min_cell double precision;
  max_cell double precision;
  total_cnt int := 0;
BEGIN
  lat_min := LEAST(south, north);
  lat_max := GREATEST(south, north);
  lng_min := LEAST(west, east);
  lng_max := GREATEST(west, east);
  lat_span := lat_max - lat_min;
  lng_span := lng_max - lng_min;
  span := GREATEST(lat_span, lng_span, 0.004);

  IF span > 3.0 THEN
    RAISE EXCEPTION 'bounds_too_large' USING ERRCODE = '22023';
  END IF;

  IF p_cell_size IS NOT NULL AND p_cell_size > 0 THEN
    cell := p_cell_size;
  ELSE
    target_side := CASE
      WHEN lv >= 11 THEN 3.8
      WHEN lv >= 10 THEN 4.2
      WHEN lv >= 9 THEN 4.8
      WHEN lv >= 8 THEN 5.4
      WHEN lv >= 7 THEN 6.0
      WHEN lv >= 6 THEN 6.8
      ELSE 7.5
    END;
    min_cell := CASE
      WHEN lv >= 11 THEN 0.04
      WHEN lv >= 10 THEN 0.028
      WHEN lv >= 9 THEN 0.018
      WHEN lv >= 8 THEN 0.011
      WHEN lv >= 7 THEN 0.007
      WHEN lv >= 6 THEN 0.0045
      ELSE 0.003
    END;
    max_cell := CASE WHEN lv >= 10 THEN 0.14 WHEN lv >= 8 THEN 0.09 ELSE 0.06 END;
    cell := GREATEST(min_cell, LEAST(max_cell, span / target_side));
  END IF;

  SELECT count(*)::int INTO total_cnt
  FROM public.places p
  WHERE p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND p.lat BETWEEN lat_min AND lat_max
    AND p.lng BETWEEN lng_min AND lng_max;

  RETURN (
    WITH grid AS (
      SELECT
        floor((p.lat - lat_min) / cell)::int AS gy,
        floor((p.lng - lng_min) / cell)::int AS gx,
        avg(p.lat)::double precision AS lat,
        avg(p.lng)::double precision AS lng,
        count(*)::int AS cnt
      FROM public.places p
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.lat BETWEEN lat_min AND lat_max
        AND p.lng BETWEEN lng_min AND lng_max
      GROUP BY gy, gx
      HAVING count(*) >= 1
      ORDER BY cnt DESC
      LIMIT 80
    )
    SELECT json_build_object(
      'clusters',
        coalesce(
          (SELECT json_agg(
            json_build_object('lat', g.lat, 'lng', g.lng, 'count', g.cnt)
            ORDER BY g.cnt DESC
          ) FROM grid g),
          '[]'::json
        ),
      'total_in_bounds', total_cnt,
      'cell_size', cell
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_place_density_in_bounds(double precision, double precision, double precision, double precision, integer, double precision) IS
  '지도 bbox 적응형 그리드 집계 — 줌 아웃 숫자 클러스터. service_role 전용.';

REVOKE ALL ON FUNCTION public.get_place_density_in_bounds(double precision, double precision, double precision, double precision, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_place_density_in_bounds(double precision, double precision, double precision, double precision, integer, double precision) TO service_role;

-- 구 5-인자 시그니처 제거(있을 경우)
DROP FUNCTION IF EXISTS public.get_place_density_in_bounds(double precision, double precision, double precision, double precision, integer);

NOTIFY pgrst, 'reload schema';
