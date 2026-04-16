-- DB mirror of supabase/migrations/20260416160000_hanjan_stats_and_check_ins_user.sql
-- 한잔함: 집계(유저+장소+KST 일 1회) · 여기서 한잔(GPS 성공) · 24h 불꽃 · 단골(근처 3일+)
-- check_ins.user_id 저장 + perform_check_in_nearby 갱신

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_check_ins_place_created
  ON public.check_ins (place_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_check_ins_place_user
  ON public.check_ins (place_id, user_id)
  WHERE user_id IS NOT NULL;

-- 기존 시그니처 제거 후 단일 함수 유지
DROP FUNCTION IF EXISTS public.perform_check_in_nearby(
  text, text, text, text,
  double precision, double precision,
  double precision, double precision,
  double precision
);

DROP FUNCTION IF EXISTS public.perform_check_in_nearby(
  text, text, text, text,
  double precision, double precision,
  double precision, double precision,
  double precision,
  boolean
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

COMMENT ON FUNCTION public.perform_check_in_nearby(
  text, text, text, text,
  double precision, double precision,
  double precision, double precision,
  double precision,
  boolean
) IS
  '한잔함(내부 체크인): 거리 검증 또는 skip. user_id=auth.uid() 기록.';

-- 장소별 한잔 통계 (공개 조회 가능)
CREATE OR REPLACE FUNCTION public.get_place_hanjan_stats(p_place_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT ci.*
    FROM public.check_ins ci
    WHERE btrim(ci.place_id) = btrim(p_place_id)
  ),
  ded AS (
    SELECT DISTINCT
      COALESCE(user_id::text, 'n:' || lower(btrim(user_nickname))) AS ukey,
      (created_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM base
  ),
  ded_near AS (
    SELECT DISTINCT
      COALESCE(user_id::text, 'n:' || lower(btrim(user_nickname))) AS ukey,
      (created_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM base
    WHERE distance_meters IS NOT NULL
  ),
  fire AS (
    SELECT DISTINCT
      COALESCE(user_id::text, 'n:' || lower(btrim(user_nickname))) AS ukey,
      (created_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM base
    WHERE created_at >= (now() AT TIME ZONE 'utc') - interval '24 hours'
  ),
  fire_today AS (
    SELECT DISTINCT
      COALESCE(user_id::text, 'n:' || lower(btrim(user_nickname))) AS ukey,
      (created_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM base
    WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date =
          (now() AT TIME ZONE 'Asia/Seoul')::date
  ),
  reg_users AS (
    SELECT
      COALESCE(user_id::text, 'n:' || lower(btrim(user_nickname))) AS ukey
    FROM base
    WHERE distance_meters IS NOT NULL
    GROUP BY 1
    HAVING COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Seoul')::date) >= 3
  )
  SELECT jsonb_build_object(
    'total_dedup', (SELECT COUNT(*)::int FROM ded),
    'nearby_dedup', (SELECT COUNT(*)::int FROM ded_near),
    'fire_24h_dedup', (SELECT COUNT(*)::int FROM fire),
    'fire_today_dedup', (SELECT COUNT(*)::int FROM fire_today),
    'regulars_nearby', (SELECT COUNT(*)::int FROM reg_users),
    'last_at', (SELECT max(created_at) FROM base)
  );
$$;

REVOKE ALL ON FUNCTION public.get_place_hanjan_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_place_hanjan_stats(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_place_hanjan_stats(text) TO authenticated;

COMMENT ON FUNCTION public.get_place_hanjan_stats(text) IS
  '장소 카드용: 한잔 누적(유저+KST일 1회), 여기서 한잔(거리 기록 있음), 24h/오늘 불꽃, 근처 단골(3일+)';
