-- 로그인 사용자 → public.curators SELECT (팔로워 목록에서 큐레이터 별명·핸들·뱃지)
-- Supabase 동일: supabase/migrations/20260423140000_curators_select_authenticated.sql

DROP POLICY IF EXISTS "curators_select_authenticated" ON public.curators;
CREATE POLICY "curators_select_authenticated"
  ON public.curators
  FOR SELECT
  TO authenticated
  USING (true);
