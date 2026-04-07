-- 1. 사용자 그룹별 검색 패턴 분석 (안전한 버전)
SELECT 
  user_type, 
  parsed_alcohol, 
  COUNT(*) as search_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM search_logs), 2) as percentage
FROM search_logs
GROUP BY user_type, parsed_alcohol
ORDER BY search_count DESC;

-- 2. 전환율 분석 (division by zero 방지)
SELECT 
  COUNT(DISTINCT sl.user_id) as searchers,
  COUNT(DISTINCT pcl.user_id) as clickers,
  CASE 
    WHEN COUNT(DISTINCT sl.user_id) > 0 
    THEN ROUND(COUNT(DISTINCT pcl.user_id) * 100.0 / COUNT(DISTINCT sl.user_id), 2)
    ELSE 0
  END as conversion_rate,
  COUNT(*) as total_searches
FROM search_logs sl
LEFT JOIN place_click_logs pcl ON sl.user_id = pcl.user_id
WHERE sl.user_type = 'registered'
  AND sl.timestamp >= NOW() - INTERVAL '7 days';

-- 3. 인기 장소 분석 (안전한 버전)
SELECT 
  place_name, 
  COUNT(*) as click_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM place_click_logs), 2) as percentage
FROM place_click_logs
WHERE user_type = 'anonymous'
GROUP BY place_name
ORDER BY click_count DESC
LIMIT 10;

-- 4. 검색 효율성 분석 (결과 없음 비율)
SELECT 
  parsed_alcohol,
  parsed_region,
  COUNT(*) as total_searches,
  SUM(CASE WHEN has_results = false THEN 1 ELSE 0 END) as no_results_count,
  CASE 
    WHEN COUNT(*) > 0 
    THEN ROUND(SUM(CASE WHEN has_results = false THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2)
    ELSE 0
  END as no_results_percentage
FROM search_logs
WHERE parsed_alcohol IS NOT NULL
GROUP BY parsed_alcohol, parsed_region
ORDER BY no_results_percentage DESC
LIMIT 20;

-- 5. 시간대별 활동 분석
SELECT 
  user_type,
  EXTRACT(HOUR FROM timestamp) as hour_of_day,
  COUNT(*) as activity_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM search_logs WHERE user_type = sl.user_type), 2) as hourly_percentage
FROM search_logs sl
GROUP BY user_type, EXTRACT(HOUR FROM timestamp)
ORDER BY user_type, hour_of_day;

-- 6. 일별 활동 요약
SELECT 
  DATE(timestamp) as date,
  user_type,
  COUNT(*) as daily_searches,
  COUNT(DISTINCT user_id) as unique_users
FROM search_logs
GROUP BY DATE(timestamp), user_type
ORDER BY date DESC, user_type;
