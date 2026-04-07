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
