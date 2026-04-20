-- Supabase 동일: supabase/migrations/20260430190000_curator_places_select_public.sql

DROP POLICY IF EXISTS "curator_places_select_public" ON public.curator_places;

CREATE POLICY "curator_places_select_public"
  ON public.curator_places
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY "curator_places_select_public" ON public.curator_places IS
  '추천 장소 연결 메타는 공개 조회 (curator_id = curators.user_id).';

NOTIFY pgrst, 'reload schema';
