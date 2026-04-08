-- 결과 없는 검색어 모니터링 (Supabase SQL Editor · Metabase 등)
-- search_logs.has_results = false 행만 집계

-- 1) 최근 7일 무결과 검색 (원문)
SELECT
  user_query,
  COUNT(*) AS n,
  MAX(timestamp) AS last_at
FROM search_logs
WHERE has_results = false
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_query
ORDER BY n DESC, last_at DESC
LIMIT 80;

-- 2) 무결과 + 지역 파싱된 케이스
SELECT
  COALESCE(parsed_region, '(지역 없음)') AS region,
  user_query,
  COUNT(*) AS n
FROM search_logs
WHERE has_results = false
  AND timestamp > NOW() - INTERVAL '14 days'
GROUP BY 1, 2
ORDER BY n DESC
LIMIT 100;

-- 3) 클라이언트 오류 후 로그
SELECT id, user_query, had_client_error, timestamp
FROM search_logs
WHERE had_client_error = true
ORDER BY timestamp DESC
LIMIT 50;
