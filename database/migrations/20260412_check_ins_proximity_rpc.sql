-- 체크인: 장소 좌표 대비 사용자 GPS 거리 검증 (SECURITY DEFINER RPC만 INSERT 허용)
-- 한계: 브라우저/앱에서 좌표를 조작하면 우회 가능. 완전 방지는 네이티브 attestation 등 별도 필요.

CREATE OR REPLACE FUNCTION public.haversine_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
AS $func$
  SELECT (
    2 * 6371000 * asin(
      least(
        1::double precision,
        sqrt(
          power(sin(radians((lat2 - lat1) / 2)), 2)
          + cos(radians(lat1)) * cos(radians(lat2))
            * power(sin(radians((lon2 - lon1) / 2)), 2)
        )
      )
    )
  )::double precision;
$func$;

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS distance_meters double precision,
  ADD COLUMN IF NOT EXISTS location_accuracy_m double precision;

CREATE OR REPLACE FUNCTION public.perform_check_in_nearby(
  p_user_nickname text,
  p_place_id text,
  p_place_name text,
  p_place_address text,
  p_place_lat double precision,
  p_place_lng double precision,
  p_user_lat double precision,
  p_user_lng double precision,
  p_accuracy_m double precision DEFAULT NULL
)
RETURNS SETOF public.check_ins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  dist double precision;
  allow_radius double precision;
  acc double precision;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'checkin_not_authenticated';
  END IF;

  IF p_place_lat IS NULL OR p_place_lng IS NULL THEN
    RAISE EXCEPTION 'checkin_place_coordinates_required';
  END IF;

  IF p_user_lat IS NULL OR p_user_lng IS NULL THEN
    RAISE EXCEPTION 'checkin_user_coordinates_required';
  END IF;

  -- 대한민국 대략 범위 (잘못된 단위/오타 완화)
  IF p_place_lat < 32.5 OR p_place_lat > 43.5
     OR p_place_lng < 123.5 OR p_place_lng > 132.5 THEN
    RAISE EXCEPTION 'checkin_place_coordinates_invalid';
  END IF;

  acc := COALESCE(p_accuracy_m, 75.0);
  IF acc > 400 THEN
    RAISE EXCEPTION 'checkin_location_accuracy_too_poor';
  END IF;

  dist := public.haversine_meters(
    p_place_lat, p_place_lng, p_user_lat, p_user_lng
  );

  -- 기본 반경 100m + 정확도 보정(최대 150m). 실내/도심 GPS 오차 허용.
  allow_radius := 100.0 + least(acc, 150.0);

  IF dist > allow_radius THEN
    RAISE EXCEPTION 'checkin_too_far_from_place'
      USING DETAIL = format('distance_m=%s allow_m=%s', dist, allow_radius);
  END IF;

  RETURN QUERY
  INSERT INTO public.check_ins (
    user_nickname,
    place_id,
    place_name,
    place_address,
    distance_meters,
    location_accuracy_m
  )
  VALUES (
    left(trim(p_user_nickname), 100),
    left(trim(p_place_id), 255),
    left(trim(p_place_name), 255),
    COALESCE(p_place_address, ''),
    dist,
    p_accuracy_m
  )
  RETURNING *;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.perform_check_in_nearby(
  text, text, text, text,
  double precision, double precision,
  double precision, double precision,
  double precision
) TO authenticated;

COMMENT ON FUNCTION public.perform_check_in_nearby IS
  '인증 사용자만. 장소-사용자 거리가 허용 반경 이내일 때만 check_ins INSERT.';

-- 직접 INSERT 차단 → 위치 검증 RPC만 사용
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.check_ins;
