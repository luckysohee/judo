-- Mirror of supabase/migrations/20260429141000_checkin_rpcs_align_hanjan.sql

CREATE OR REPLACE FUNCTION public.get_place_checkin_count(p_place_id VARCHAR)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (public.get_place_hanjan_stats(btrim(p_place_id::text)) ->> 'total_dedup')::bigint,
    0
  );
$$;

COMMENT ON FUNCTION public.get_place_checkin_count(VARCHAR) IS
  '지도 마커 배지용: 한잔 누적 집계(total_dedup) — get_place_hanjan_stats 와 동일';

CREATE OR REPLACE FUNCTION public.get_checkin_ranking()
RETURNS TABLE (
  place_id VARCHAR,
  place_name VARCHAR,
  place_address TEXT,
  total_checkins BIGINT,
  latest_checkin_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  WITH cell AS (
    SELECT DISTINCT
      btrim(ci.place_id::text) AS pid,
      COALESCE(ci.user_id::text, 'n:' || lower(btrim(ci.user_nickname))) AS ukey,
      (ci.created_at AT TIME ZONE 'Asia/Seoul')::date AS d,
      ci.created_at AS ats,
      ci.place_name,
      ci.place_address
    FROM public.check_ins ci
    WHERE ci.created_at >= (now() - INTERVAL '24 hours')
  ),
  agg AS (
    SELECT
      c.pid AS place_id,
      COUNT(*)::bigint AS total_checkins,
      MAX(c.ats) AS latest_checkin_time,
      (array_agg(c.place_name ORDER BY c.ats DESC))[1] AS place_name,
      (array_agg(c.place_address ORDER BY c.ats DESC))[1] AS place_address
    FROM cell c
    GROUP BY c.pid
  )
  SELECT
    a.place_id::varchar,
    a.place_name::varchar,
    a.place_address::text,
    a.total_checkins,
    a.latest_checkin_time
  FROM agg a
  WHERE a.total_checkins >= 1
  ORDER BY a.total_checkins DESC, a.latest_checkin_time DESC
  LIMIT 5;
END;
$func$;

COMMENT ON FUNCTION public.get_checkin_ranking() IS
  '홈 핫 스트립 TOP5: 최근 24h 한잔(유저+KST일 dedup) 기준';
