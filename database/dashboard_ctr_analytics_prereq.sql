-- =============================================================================
-- CTR 대시보드용 컬럼 부트스트랩 (Supabase SQL Editor에서 **1회** 실행)
-- `dashboard_ctr_path_by_visible_bucket.sql` 등에서 42703 나면 이 파일을 먼저 실행하세요.
-- Supabase CLI 마이그레이션으로 이미 적용했다면 스킵해도 됩니다 (IF NOT EXISTS 멱등).
-- =============================================================================

ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS submit_user_visible_candidate_count INTEGER;
ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS submit_initial_search_kind TEXT;
ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS submit_keyword_ai_fallback BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.place_click_logs
  ADD COLUMN IF NOT EXISTS search_click_path TEXT;
ALTER TABLE public.place_click_logs
  ADD COLUMN IF NOT EXISTS clicked_rank INTEGER;
ALTER TABLE public.place_click_logs
  ADD COLUMN IF NOT EXISTS user_visible_candidate_count INTEGER;
