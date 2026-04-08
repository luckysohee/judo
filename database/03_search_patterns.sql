-- 3. 사용자 그룹별 검색 패턴
-- ML 전(7단계): 인기 조합은 아래처럼 parsed_* GROUP BY 집계로 충분. 클라이언트 가이드: src/utils/searchPhase7Guidance.js
--
-- 예: 지역+주종+분위기 조합 (데이터 쌓인 뒤)
-- SELECT parsed_region, parsed_alcohol, parsed_vibe, COUNT(*) AS n
-- FROM search_logs WHERE parsed_region IS NOT NULL GROUP BY 1,2,3 ORDER BY n DESC LIMIT 30;

SELECT 
  sl.user_type, 
  sl.parsed_alcohol, 
  COUNT(*) as search_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM search_logs WHERE user_type = sl.user_type), 2) as percentage
FROM search_logs AS sl
WHERE sl.parsed_alcohol IS NOT NULL
GROUP BY sl.user_type, sl.parsed_alcohol
ORDER BY search_count DESC;
