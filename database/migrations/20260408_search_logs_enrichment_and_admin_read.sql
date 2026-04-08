-- 검색 로그 확장 + 관리자 전체 조회 + 무결과 모니터링용 인덱스
-- Supabase SQL Editor에서 한 번 실행

ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS parsed_food TEXT;
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS parsed_tags_normalized TEXT[];
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS search_mode TEXT;
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS had_client_error BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_search_logs_has_results_time
  ON search_logs (has_results, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_search_logs_zero_results
  ON search_logs (timestamp DESC)
  WHERE has_results = false;

-- 관리자: 전체 search_logs 조회 (profiles.role = 'admin')
DROP POLICY IF EXISTS "Admins can view all search logs" ON search_logs;
CREATE POLICY "Admins can view all search logs" ON search_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
