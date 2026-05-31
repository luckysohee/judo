-- 대시보드: searchClickPath별 상단(1~3위) 클릭 비율
-- Metabase / Supabase SQL Editor. place_click_logs CTR 컬럼 마이그레이션 적용 후 사용.
--
-- 해석: keyword_fallback이 keyword_pure보다 1~3위 비율이 높으면 fallback이 상단에서 더 잘 먹는 편.

WITH base AS (
  SELECT
    search_click_path,
    clicked_rank
  FROM place_click_logs
  WHERE search_click_path IS NOT NULL
    AND clicked_rank IS NOT NULL
    AND clicked_rank > 0
    AND timestamp >= NOW() - INTERVAL '30 days'
)
SELECT
  search_click_path,
  COUNT(*) AS clicks_with_rank,
  COUNT(*) FILTER (WHERE clicked_rank = 1) AS rank_1,
  COUNT(*) FILTER (WHERE clicked_rank = 2) AS rank_2,
  COUNT(*) FILTER (WHERE clicked_rank = 3) AS rank_3,
  COUNT(*) FILTER (WHERE clicked_rank BETWEEN 1 AND 3) AS rank_1_to_3,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE clicked_rank BETWEEN 1 AND 3) / NULLIF(COUNT(*), 0),
    1
  ) AS pct_rank_1_to_3
FROM base
GROUP BY search_click_path
ORDER BY clicks_with_rank DESC;
