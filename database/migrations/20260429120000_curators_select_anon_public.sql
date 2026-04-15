-- Supabase 동일: supabase/migrations/20260429120000_curators_select_anon_public.sql

DROP POLICY IF EXISTS "curators_select_anon_public" ON public.curators;
CREATE POLICY "curators_select_anon_public"
  ON public.curators
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "curators_select_anon_public" ON public.curators IS
  '비로그인 홈: curator_places→curators 조인으로 username/display_name 표시';

NOTIFY pgrst, 'reload schema';
