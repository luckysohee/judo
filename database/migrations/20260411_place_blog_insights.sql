-- 블로그 키워드 + LLM 한 줄 요약 캐시 (통합 검색 서버가 service role로 읽기/쓰기)
-- Supabase SQL Editor에서 실행하거나 마이그레이션 파이프라인에 포함

CREATE TABLE IF NOT EXISTS place_blog_insights (
  external_place_id TEXT PRIMARY KEY,
  place_name_snapshot TEXT,
  review_count INT NOT NULL DEFAULT 0,
  keywords JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  content_fingerprint TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_place_blog_insights_expires
  ON place_blog_insights (expires_at);

COMMENT ON TABLE place_blog_insights IS '네이버 블로그 기반 장소 인사이트 캐시 (키워드 JSON + LLM 요약)';

ALTER TABLE place_blog_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "place_blog_insights_select_all" ON place_blog_insights;
CREATE POLICY "place_blog_insights_select_all"
  ON place_blog_insights FOR SELECT
  USING (true);

-- anon은 쓰기 불가; 서버는 SUPABASE_SERVICE_ROLE_KEY로 RLS 우회하여 upsert
