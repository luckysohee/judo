-- 2. 전환율 분석 (완전히 수정된 버전)
SELECT 
  COUNT(DISTINCT sl.user_id) as searchers,
  COUNT(DISTINCT pcl.user_id) as clickers,
  COUNT(*) as total_searches,
  ROUND(
    COUNT(DISTINCT pcl.user_id) * 100.0 / NULLIF(COUNT(DISTINCT sl.user_id), 0), 
    2
  ) as conversion_rate
FROM search_logs AS sl
LEFT JOIN place_click_logs AS pcl ON sl.user_id = pcl.user_id
WHERE sl.user_type = 'registered'
  AND sl.timestamp >= NOW() - INTERVAL '7 days';
