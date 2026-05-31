-- 평균 clicked_rank by searchClickPath (낮을수록 상단 클릭이 많음)
-- place_click_logs CTR 컬럼 마이그레이션 적용 후 사용.

SELECT
  search_click_path,
  COUNT(*) AS clicks_with_rank,
  ROUND(AVG(clicked_rank)::numeric, 2) AS avg_clicked_rank
FROM place_click_logs
WHERE search_click_path IS NOT NULL
  AND clicked_rank IS NOT NULL
  AND clicked_rank > 0
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY search_click_path
ORDER BY search_click_path;
