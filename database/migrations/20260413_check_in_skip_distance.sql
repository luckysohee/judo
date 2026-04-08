-- 거리/GPS 없이 체크인 허용 옵션 (p_skip_distance_check = true)
-- distance_meters / location_accuracy_m 는 NULL → 앱에서 "위치 미검증"으로 해석 가능

DROP FUNCTION IF EXISTS public.perform_check_in_nearby(
  text, text, text, text,
  double precision, double precision,
  double precision, double precision,
  double precision
);

CREATE OR REPLACE FUNCTION public.perform_check_in_nearby(
  p_user_nickname text,
  p_place_id text,
  p_place_name text,
  p_place_address text,
  p_place_lat double precision,
  p_place_lng double precision,
  p_user_lat double precision,
  p_user_lng double precision,
  p_accuracy_m double precision DEFAULT NULL,
  p_skip_distance_check boolean DEFAULT false
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
  skip boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'checkin_not_authenticated';
  END IF;

  skip := COALESCE(p_skip_distance_check, false);

  IF skip THEN
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
      NULL,
      NULL
    )
    RETURNING *;
    RETURN;
  END IF;

  IF p_place_lat IS NULL OR p_place_lng IS NULL THEN
    RAISE EXCEPTION 'checkin_place_coordinates_required';
  END IF;

  IF p_user_lat IS NULL OR p_user_lng IS NULL THEN
    RAISE EXCEPTION 'checkin_user_coordinates_required';
  END IF;

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
  double precision,
  boolean
) TO authenticated;

COMMENT ON FUNCTION public.perform_check_in_nearby IS
  '인증 사용자만. 기본은 GPS 근접 검증. p_skip_distance_check 시 거리·GPS 생략(distance_meters NULL).';
