-- 검색 세션 상관·북마크 전환 추적 (4단계 로그)
-- Supabase SQL Editor 또는 마이그레이션 파이프라인에서 실행

-- 앱 insert와 맞추기 (기존 add_user_type_columns.sql 미적용 환경 대비)
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT false;
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'anonymous';
ALTER TABLE place_click_logs ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT false;
ALTER TABLE place_click_logs ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'anonymous';

ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS session_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_logs_session_id_unique
  ON search_logs(session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS bookmarked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS bookmarked_place_id TEXT;

ALTER TABLE place_click_logs ADD COLUMN IF NOT EXISTS search_session_id UUID;
CREATE INDEX IF NOT EXISTS idx_place_click_logs_search_session_id
  ON place_click_logs(search_session_id)
  WHERE search_session_id IS NOT NULL;

ALTER TABLE user_saved_places ADD COLUMN IF NOT EXISTS search_session_id UUID;
CREATE INDEX IF NOT EXISTS idx_user_saved_places_search_session_id
  ON user_saved_places(search_session_id)
  WHERE search_session_id IS NOT NULL;

-- 로그인 사용자: 자신의 검색 로그 행에서 북마크 플래그만 갱신 가능
DROP POLICY IF EXISTS "Users can update own search logs bookmark" ON search_logs;
CREATE POLICY "Users can update own search logs bookmark" ON search_logs
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
