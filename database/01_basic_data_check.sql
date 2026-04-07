-- 1. 기본 데이터 확인 (먼저 실행)
SELECT 
  user_type,
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(timestamp) as earliest_search,
  MAX(timestamp) as latest_search
FROM search_logs
GROUP BY user_type;
