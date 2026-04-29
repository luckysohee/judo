-- 오늘 한잔 TOP 중복 분리 수정:
-- 1) place_id가 UUID/카카오ID로 섞여도 가능한 한 kakao_place_id 기준으로 통합
-- 2) 최근 24h 집계는 유저+KST일 단위로 정확히 dedup

CREATE OR REPLACE FUNCTION public.get_checkin_ranking()
RETURNS TABLE (
  place_id VARCHAR,
  place_name VARCHAR,
  place_address TEXT,
  total_checkins BIGINT,
  latest_checkin_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      btrim(ci.place_id::text) AS pid_raw,
      CASE
        WHEN btrim(ci.place_id::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN btrim(ci.place_id::text)::uuid
        ELSE NULL
      END AS pid_uuid,
      COALESCE(ci.user_id::text, 'n:' || lower(btrim(ci.user_nickname))) AS ukey,
      (ci.created_at AT TIME ZONE 'Asia/Seoul')::date AS d,
      ci.created_at AS ats,
      ci.place_name,
      ci.place_address
    FROM public.check_ins ci
    WHERE ci.created_at >= (now() - INTERVAL '24 hours')
      AND btrim(ci.place_id::text) <> ''
  ),
  enriched AS (
    SELECT
      COALESCE(
        NULLIF(btrim(p.kakao_place_id), ''),
        b.pid_raw
      ) AS pid_canon,
      b.ukey,
      b.d,
      b.ats,
      COALESCE(NULLIF(btrim(p.name), ''), b.place_name) AS place_name_canon,
      COALESCE(NULLIF(btrim(p.address), ''), b.place_address) AS place_address_canon
    FROM base b
    LEFT JOIN public.places p
      ON (
        (b.pid_uuid IS NOT NULL AND p.id = b.pid_uuid)
        OR (
          p.kakao_place_id IS NOT NULL
          AND btrim(p.kakao_place_id) <> ''
          AND btrim(p.kakao_place_id) = b.pid_raw
        )
      )
  ),
  ded AS (
    SELECT
      e.pid_canon,
      e.ukey,
      e.d,
      MAX(e.ats) AS ats,
      (array_agg(e.place_name_canon ORDER BY e.ats DESC))[1] AS place_name_canon,
      (array_agg(e.place_address_canon ORDER BY e.ats DESC))[1] AS place_address_canon
    FROM enriched e
    GROUP BY e.pid_canon, e.ukey, e.d
  ),
  agg AS (
    SELECT
      d.pid_canon AS place_id,
      COUNT(*)::bigint AS total_checkins,
      MAX(d.ats) AS latest_checkin_time,
      (array_agg(d.place_name_canon ORDER BY d.ats DESC))[1] AS place_name,
      (array_agg(d.place_address_canon ORDER BY d.ats DESC))[1] AS place_address
    FROM ded d
    GROUP BY d.pid_canon
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
$$;

COMMENT ON FUNCTION public.get_checkin_ranking() IS
  '홈 핫 스트립 TOP5: 최근 24h 한잔(유저+KST일 dedup), 장소 키 canonical(kakao_place_id 우선) 집계';
