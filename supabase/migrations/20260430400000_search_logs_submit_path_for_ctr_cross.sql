-- searchClickPath × 노출 구간 교차 CTR: 제출 시점 분기(초기 키워드 vs AI, fallback 여부)
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS submit_initial_search_kind TEXT;
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS submit_keyword_ai_fallback BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN search_logs.submit_initial_search_kind IS
  'detectHomeSearchExecutionKind 결과: keyword_search | ai_parse_search';
COMMENT ON COLUMN search_logs.submit_keyword_ai_fallback IS
  'keyword 경로에서 AI 보조(fallback)로 전환됐으면 true — keyword_fallback vs pure 구분';

CREATE INDEX IF NOT EXISTS idx_search_logs_submit_path_bucket
  ON search_logs (submit_initial_search_kind, submit_keyword_ai_fallback, timestamp DESC)
  WHERE session_id IS NOT NULL;
