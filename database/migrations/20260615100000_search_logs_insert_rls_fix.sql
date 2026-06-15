-- 검색·클릭 분석 로그: anon / authenticated INSERT 허용 (UX 무관, RLS·GRANT 정리)
-- Supabase: supabase/migrations/20260615100000_search_logs_insert_rls_fix.sql

GRANT INSERT ON TABLE public.search_logs TO anon, authenticated;
GRANT INSERT ON TABLE public.place_click_logs TO anon, authenticated;

DROP POLICY IF EXISTS "Anonymous users can insert search logs" ON public.search_logs;
DROP POLICY IF EXISTS "Users can insert own search logs" ON public.search_logs;
DROP POLICY IF EXISTS "Anonymous users can insert place click logs" ON public.place_click_logs;
DROP POLICY IF EXISTS "Users can insert own place click logs" ON public.place_click_logs;

CREATE POLICY "Anonymous users can insert search logs" ON public.search_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id = 'anonymous');

CREATE POLICY "Users can insert own search logs" ON public.search_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Anonymous users can insert place click logs" ON public.place_click_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id = 'anonymous');

CREATE POLICY "Users can insert own place click logs" ON public.place_click_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);
