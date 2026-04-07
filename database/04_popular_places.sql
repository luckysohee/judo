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
