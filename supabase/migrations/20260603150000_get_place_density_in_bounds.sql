-- 줌 아웃용 빠른 그리드 집계 (join 없음) — 숫자 클러스터 레이어

CREATE OR REPLACE FUNCTION public.get_place_density_in_bounds(
  south double precision,
  west double precision,
  north double precision,
  east double precision,
  p_level integer DEFAULT 8
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
  cell double precision;
  lv int := greatest(1, least(coalesce(p_level, 8), 14));
  total_cnt int := 0;
BEGIN
  lat_min := LEAST(south, north);
  lat_max := GREATEST(south, north);
  lng_min := LEAST(west, east);
  lng_max := GREATEST(west, east);

  IF (lat_max - lat_min) > 3.0 OR (lng_max - lng_min) > 3.0 THEN
    RAISE EXCEPTION 'bounds_too_large' USING ERRCODE = '22023';
  END IF;

  cell := CASE
    WHEN lv >= 10 THEN 0.018
    WHEN lv >= 9 THEN 0.012
    WHEN lv >= 8 THEN 0.008
    WHEN lv >= 7 THEN 0.005
    WHEN lv >= 6 THEN 0.0032
    ELSE 0.002
  END;

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
      LIMIT 160
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
      'total_in_bounds', total_cnt
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_place_density_in_bounds(double precision, double precision, double precision, double precision, integer) IS
  '지도 bbox 그리드 집계 — 줌 아웃 숫자 클러스터용. service_role 전용.';

REVOKE ALL ON FUNCTION public.get_place_density_in_bounds(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_place_density_in_bounds(double precision, double precision, double precision, double precision, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
