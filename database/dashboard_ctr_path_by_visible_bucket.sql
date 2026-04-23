-- searchClickPath × 노출 구간(제출 시점 실보이 행 수) 교차 세션 CTR
--
-- ERROR: 42703 column submit_initial_search_kind does not exist
--   → Supabase SQL Editor에서 **먼저** 실행:
--        database/dashboard_ctr_analytics_prereq.sql
--   → 또는 마이그레이션 적용:
--        supabase/migrations/20260430380000_place_click_logs_ctr_columns.sql
--        supabase/migrations/20260430390000_search_logs_submit_visible_count.sql
--        supabase/migrations/20260430400000_search_logs_submit_path_for_ctr_cross.sql
--
-- Metabase: 차트 쿼리에는 DDL 넣지 말고, 위 부트스트랩은 DB에 1회만 적용하세요.
--
-- 전제 컬럼: search_logs.submit_initial_search_kind, submit_keyword_ai_fallback,
--           submit_user_visible_candidate_count + place_click_logs.search_session_id, search_click_path
--
-- search_click_path 유도(제출 스냅샷):
--   keyword_search + fallback false → keyword_pure
--   keyword_search + fallback true  → keyword_fallback
--   ai_parse_search                 → ai_direct

WITH searched AS (
  SELECT
    sl.session_id,
    CASE
      WHEN sl.submit_initial_search_kind = 'keyword_search'
        AND COALESCE(sl.submit_keyword_ai_fallback, false) = false
        THEN 'keyword_pure'
      WHEN sl.submit_initial_search_kind = 'keyword_search'
        AND sl.submit_keyword_ai_fallback = true
        THEN 'keyword_fallback'
      WHEN sl.submit_initial_search_kind = 'ai_parse_search'
        THEN 'ai_direct'
      ELSE NULL
    END AS search_click_path,
    CASE
      WHEN sl.submit_user_visible_candidate_count = 1 THEN '1'
      WHEN sl.submit_user_visible_candidate_count BETWEEN 2 AND 3 THEN '2-3'
      WHEN sl.submit_user_visible_candidate_count BETWEEN 4 AND 6 THEN '4-6'
      WHEN sl.submit_user_visible_candidate_count >= 7 THEN '7+'
      ELSE NULL
    END AS visible_bucket
  FROM search_logs sl
  WHERE sl.session_id IS NOT NULL
    AND sl.submit_user_visible_candidate_count IS NOT NULL
    AND sl.submit_user_visible_candidate_count >= 1
    AND sl.submit_initial_search_kind IS NOT NULL
    AND sl.timestamp >= NOW() - INTERVAL '30 days'
),
searched2 AS (
  SELECT * FROM searched WHERE search_click_path IS NOT NULL AND visible_bucket IS NOT NULL
),
sessions AS (
  SELECT search_click_path, visible_bucket, COUNT(DISTINCT session_id) AS search_sessions
  FROM searched2
  GROUP BY 1, 2
),
converted AS (
  SELECT DISTINCT pcl.search_session_id AS session_id, pcl.search_click_path
  FROM place_click_logs pcl
  WHERE pcl.search_session_id IS NOT NULL
    AND pcl.search_click_path IS NOT NULL
    AND pcl.timestamp >= NOW() - INTERVAL '30 days'
),
joined AS (
  SELECT
    s.search_click_path,
    s.visible_bucket,
    COUNT(DISTINCT s.session_id) AS sessions_with_click
  FROM searched2 s
  INNER JOIN converted c
    ON c.session_id = s.session_id
   AND c.search_click_path = s.search_click_path
  GROUP BY 1, 2
)
SELECT
  s.search_click_path,
  s.visible_bucket,
  s.search_sessions,
  COALESCE(j.sessions_with_click, 0) AS sessions_with_search_click,
  ROUND(
    100.0 * COALESCE(j.sessions_with_click, 0) / NULLIF(s.search_sessions, 0),
    1
  ) AS session_ctr_pct
FROM sessions s
LEFT JOIN joined j
  ON j.search_click_path = s.search_click_path
 AND j.visible_bucket = s.visible_bucket
ORDER BY
  CASE s.search_click_path
    WHEN 'keyword_pure' THEN 1
    WHEN 'keyword_fallback' THEN 2
    WHEN 'ai_direct' THEN 3
    ELSE 9
  END,
  CASE s.visible_bucket
    WHEN '1' THEN 1
    WHEN '2-3' THEN 2
    WHEN '4-6' THEN 3
    ELSE 4
  END;
