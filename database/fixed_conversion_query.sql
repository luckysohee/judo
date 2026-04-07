-- 전환율 분석 (수정된 버전)
SELECT 
  COUNT(DISTINCT sl.user_id) as searchers,
  COUNT(DISTINCT pcl.user_id) as clickers,
  COUNT(*) as total_searches,
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT sl.user_id) > 0 
      THEN COUNT(DISTINCT pcl.user_id) * 100.0 / COUNT(DISTINCT sl.user_id)
      ELSE 0
    END, 
    2
  ) as conversion_rate
FROM search_logs sl
LEFT JOIN place_click_logs pcl ON sl.user_id = pcl.user_id
WHERE sl.user_type = 'registered'
  AND sl.timestamp >= NOW() - INTERVAL '7 days';

-- 더 간단한 버전 (NULLIF 사용)
SELECT 
  COUNT(DISTINCT sl.user_id) as searchers,
  COUNT(DISTINCT pcl.user_id) as clickers,
  COUNT(*) as total_searches,
  ROUND(
    COUNT(DISTINCT pcl.user_id) * 100.0 / NULLIF(COUNT(DISTINCT sl.user_id), 0), 
    2
  ) as conversion_rate
FROM search_logs sl
LEFT JOIN place_click_logs pcl ON sl.user_id = pcl.user_id
WHERE sl.user_type = 'registered'
  AND sl.timestamp >= NOW() - INTERVAL '7 days';

-- 테스트용 간단 버전 (데이터 확인)
SELECT 
  'registered' as user_type,
  COUNT(*) as total_searches,
  COUNT(DISTINCT user_id) as unique_searchers
FROM search_logs 
WHERE user_type = 'registered'
  AND timestamp >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'anonymous' as user_type,
  COUNT(*) as total_searches,
  COUNT(DISTINCT user_id) as unique_searchers
FROM search_logs 
WHERE user_type = 'anonymous'
  AND timestamp >= NOW() - INTERVAL '7 days';
