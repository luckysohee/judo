-- searchClickPath × 노출 구간 교차 CTR (Supabase 동일 파일명 참고)

ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS submit_initial_search_kind TEXT;
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS submit_keyword_ai_fallback BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN search_logs.submit_initial_search_kind IS
  'detectHomeSearchExecutionKind: keyword_search | ai_parse_search';
COMMENT ON COLUMN search_logs.submit_keyword_ai_fallback IS
  'keyword에서 AI fallback 발동 시 true';

CREATE INDEX IF NOT EXISTS idx_search_logs_submit_path_bucket
  ON search_logs (submit_initial_search_kind, submit_keyword_ai_fallback, timestamp DESC)
  WHERE session_id IS NOT NULL;
