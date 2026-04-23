-- submit 시점 실보이 행 수 구간별 검색 세션 CTR
-- 전제: search_logs.submit_user_visible_candidate_count 채움 + place_click_logs.search_session_id·search_click_path
--
-- 구간: 1개 / 2~3 / 4~6 / 7개 이상
-- 분모: 해당 구간의 검색 세션 수
-- 분자: 그 세션에서 searchClickPath가 붙은 장소 클릭이 1회 이상인 세션 수

WITH searched AS (
  SELECT
    session_id,
    submit_user_visible_candidate_count AS n
  FROM search_logs
  WHERE session_id IS NOT NULL
    AND submit_user_visible_candidate_count IS NOT NULL
    AND submit_user_visible_candidate_count >= 1
    AND timestamp >= NOW() - INTERVAL '30 days'
),
bucketed AS (
  SELECT
    session_id,
    CASE
      WHEN n = 1 THEN '1'
      WHEN n BETWEEN 2 AND 3 THEN '2-3'
      WHEN n BETWEEN 4 AND 6 THEN '4-6'
      ELSE '7+'
    END AS bucket
  FROM searched
),
sessions AS (
  SELECT bucket, COUNT(DISTINCT session_id) AS search_sessions
  FROM bucketed
  GROUP BY bucket
),
converted AS (
  SELECT DISTINCT pcl.search_session_id AS session_id
  FROM place_click_logs pcl
  WHERE pcl.search_session_id IS NOT NULL
    AND pcl.search_click_path IS NOT NULL
    AND pcl.timestamp >= NOW() - INTERVAL '30 days'
),
joined AS (
  SELECT b.bucket, COUNT(DISTINCT b.session_id) AS sessions_with_click
  FROM bucketed b
  INNER JOIN converted c ON c.session_id = b.session_id
  GROUP BY b.bucket
)
SELECT
  s.bucket,
  s.search_sessions,
  COALESCE(j.sessions_with_click, 0) AS sessions_with_search_click,
  ROUND(
    100.0 * COALESCE(j.sessions_with_click, 0) / NULLIF(s.search_sessions, 0),
    1
  ) AS session_ctr_pct
FROM sessions s
LEFT JOIN joined j ON j.bucket = s.bucket
ORDER BY
  CASE s.bucket
    WHEN '1' THEN 1
    WHEN '2-3' THEN 2
    WHEN '4-6' THEN 3
    ELSE 4
  END;
