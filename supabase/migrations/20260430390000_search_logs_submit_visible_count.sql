-- 검색 직후 첫 화면에 올라간 후보 행 수(클릭 로그의 user_visible_candidate_count와 같은 계열, 제출 시점 스냅샷)
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS submit_user_visible_candidate_count INTEGER;

COMMENT ON COLUMN search_logs.submit_user_visible_candidate_count IS
  '검색 완료 직후 파이프라인이 리스트·시트에 넣은 행 수. 구간별 CTR 분모용; engineScoredPoolSize와 혼용 금지.';

CREATE INDEX IF NOT EXISTS idx_search_logs_submit_visible
  ON search_logs (submit_user_visible_candidate_count, timestamp DESC)
  WHERE submit_user_visible_candidate_count IS NOT NULL;
