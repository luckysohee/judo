-- 큐레이터 대표 메뉴(시그니처 1~3개용 텍스트). 카드·지도에 인앱 노출.
-- supabase/migrations/20260927120000_curator_places_recommended_menu.sql 과 동일

ALTER TABLE public.curator_places
  ADD COLUMN IF NOT EXISTS recommended_menu text;

COMMENT ON COLUMN public.curator_places.recommended_menu IS
  '추천 대표 메뉴. 쉼표·중점 등으로 구분한 짧은 텍스트(카드에서 1~3개로 파싱).';
