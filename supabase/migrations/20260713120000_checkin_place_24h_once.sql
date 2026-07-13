-- 한잔함: 같은 장소·같은 유저는 rolling 24시간에 1회만 INSERT
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
  pid text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'checkin_not_authenticated';
  END IF;

  pid := left(btrim(COALESCE(p_place_id, '')), 255);
  IF pid = '' THEN
    RAISE EXCEPTION 'checkin_place_id_required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.check_ins ci
    WHERE ci.user_id = auth.uid()
      AND btrim(ci.place_id::text) = pid
      AND ci.created_at >= (now() - INTERVAL '24 hours')
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'checkin_already_within_24h';
  END IF;

  skip := COALESCE(p_skip_distance_check, false);

  IF skip THEN
    RETURN QUERY
    INSERT INTO public.check_ins (
      user_id,
      user_nickname,
      place_id,
      place_name,
      place_address,
      distance_meters,
      location_accuracy_m
    )
    VALUES (
      auth.uid(),
      left(trim(p_user_nickname), 100),
      pid,
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

  acc := COALESCE(p_accuracy_m, 120.0);
  IF acc > 2500 THEN
    RAISE EXCEPTION 'checkin_location_accuracy_too_poor';
  END IF;

  dist := public.haversine_meters(
    p_place_lat, p_place_lng, p_user_lat, p_user_lng
  );

  allow_radius := 140.0 + least(acc, 280.0);

  IF dist > allow_radius THEN
    RAISE EXCEPTION 'checkin_too_far_from_place'
      USING DETAIL = format('distance_m=%s allow_m=%s', dist, allow_radius);
  END IF;

  RETURN QUERY
  INSERT INTO public.check_ins (
    user_id,
    user_nickname,
    place_id,
    place_name,
    place_address,
    distance_meters,
    location_accuracy_m
  )
  VALUES (
    auth.uid(),
    left(trim(p_user_nickname), 100),
    pid,
    left(trim(p_place_name), 255),
    COALESCE(p_place_address, ''),
    dist,
    p_accuracy_m
  )
  RETURNING *;
END;
$func$;

COMMENT ON FUNCTION public.perform_check_in_nearby(
  text, text, text, text,
  double precision, double precision,
  double precision, double precision,
  double precision,
  boolean
) IS
  '한잔함: 거리 검증 또는 skip. 같은 장소·유저 rolling 24h 1회. user_id=auth.uid().';
