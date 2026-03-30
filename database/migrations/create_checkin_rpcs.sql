-- 핫플레이스를 찾기 위한 RPC 함수
CREATE OR REPLACE FUNCTION get_hot_places()
RETURNS TABLE (
  place_id VARCHAR,
  place_name VARCHAR,
  place_address TEXT,
  recent_checkins_count BIGINT,
  latest_checkin_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.place_id,
    ci.place_name,
    ci.place_address,
    COUNT(*) as recent_checkins_count,
    MAX(ci.created_at) as latest_checkin_time
  FROM check_ins ci
  WHERE ci.created_at >= NOW() - INTERVAL '3 hours'
  GROUP BY ci.place_id, ci.place_name, ci.place_address
  HAVING COUNT(*) >= 3
  ORDER BY recent_checkins_count DESC, latest_checkin_time DESC;
END;
$$ LANGUAGE plpgsql;

-- 실시간 체크인 랭킹 TOP 5
CREATE OR REPLACE FUNCTION get_checkin_ranking()
RETURNS TABLE (
  place_id VARCHAR,
  place_name VARCHAR,
  place_address TEXT,
  total_checkins BIGINT,
  latest_checkin_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.place_id,
    ci.place_name,
    ci.place_address,
    COUNT(*) as total_checkins,
    MAX(ci.created_at) as latest_checkin_time
  FROM check_ins ci
  WHERE ci.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY ci.place_id, ci.place_name, ci.place_address
  ORDER BY total_checkins DESC, latest_checkin_time DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 특정 장소의 실시간 체크인 수
CREATE OR REPLACE FUNCTION get_place_checkin_count(p_place_id VARCHAR)
RETURNS BIGINT AS $$
DECLARE
  checkin_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO checkin_count
  FROM check_ins 
  WHERE place_id = p_place_id 
  AND created_at >= NOW() - INTERVAL '3 hours';
  
  RETURN COALESCE(checkin_count, 0);
END;
$$ LANGUAGE plpgsql;
