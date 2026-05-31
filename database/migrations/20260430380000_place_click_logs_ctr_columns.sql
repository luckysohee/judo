-- place_click_logs: 검색 CTR 버킷·클릭 순번·실보이 후보 수 (대시보드: clickedRank 1~3 by searchClickPath)
-- Supabase 동일 파일: supabase/migrations/20260430380000_place_click_logs_ctr_columns.sql

ALTER TABLE place_click_logs ADD COLUMN IF NOT EXISTS search_click_path TEXT;
ALTER TABLE place_click_logs ADD COLUMN IF NOT EXISTS clicked_rank INTEGER;
ALTER TABLE place_click_logs ADD COLUMN IF NOT EXISTS user_visible_candidate_count INTEGER;

COMMENT ON COLUMN place_click_logs.search_click_path IS 'keyword_pure | keyword_fallback | ai_direct (검색 세션 직후 화이트리스트 소스만)';
COMMENT ON COLUMN place_click_logs.clicked_rank IS '1-based 리스트·시트에서의 클릭 순번';
COMMENT ON COLUMN place_click_logs.user_visible_candidate_count IS '클릭 시점 사용자에게 실제로 보이던 후보 행 수';

CREATE INDEX IF NOT EXISTS idx_place_click_logs_path_time
  ON place_click_logs (search_click_path, timestamp DESC)
  WHERE search_click_path IS NOT NULL;

DROP POLICY IF EXISTS "Admins can view all place click logs" ON place_click_logs;
CREATE POLICY "Admins can view all place click logs" ON place_click_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
