-- 1. 기본 데이터 확인 (먼저 실행)
SELECT 
  user_type,
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(timestamp) as earliest_search,
  MAX(timestamp) as latest_search
FROM search_logs
GROUP BY user_type;

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

-- 3. 사용자 그룹별 검색 패턴
SELECT 
  sl.user_type, 
  sl.parsed_alcohol, 
  COUNT(*) as search_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM search_logs WHERE user_type = sl.user_type), 2) as percentage
FROM search_logs AS sl
WHERE sl.parsed_alcohol IS NOT NULL
GROUP BY sl.user_type, sl.parsed_alcohol
ORDER BY search_count DESC;

-- 4. 인기 장소 분석
SELECT 
  pcl.place_name, 
  pcl.user_type,
  COUNT(*) as click_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM place_click_logs WHERE user_type = pcl.user_type), 2) as percentage
FROM place_click_logs AS pcl
GROUP BY pcl.place_name, pcl.user_type
ORDER BY click_count DESC
LIMIT 10;

-- 5. 검색 효율성 분석
SELECT 
  sl.parsed_alcohol,
  sl.parsed_region,
  COUNT(*) as total_searches,
  SUM(CASE WHEN sl.has_results = false THEN 1 ELSE 0 END) as no_results_count,
  ROUND(
    SUM(CASE WHEN sl.has_results = false THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 
    2
  ) as no_results_percentage
FROM search_logs AS sl
WHERE sl.parsed_alcohol IS NOT NULL
GROUP BY sl.parsed_alcohol, sl.parsed_region
HAVING COUNT(*) > 0
ORDER BY no_results_percentage DESC
LIMIT 20;

-- 6. 일별 활동 추이
SELECT 
  DATE(sl.timestamp) as date,
  sl.user_type,
  COUNT(*) as daily_searches,
  COUNT(DISTINCT sl.user_id) as unique_users
FROM search_logs AS sl
GROUP BY DATE(sl.timestamp), sl.user_type
ORDER BY date DESC, sl.user_type;
