-- 공개 큐레이터 추천·프로필·지도: anon/authenticated 가 curator_places 행을 읽을 수 있어야 함.
-- (DELETE 전용 정책만 있으면 RLS ON 시 SELECT 기본 거부 → 조인·리스트가 빈 배열)

DROP POLICY IF EXISTS "curator_places_select_public" ON public.curator_places;

CREATE POLICY "curator_places_select_public"
  ON public.curator_places
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY "curator_places_select_public" ON public.curator_places IS
  '추천 장소 연결 메타는 공개 조회 (curator_id = curators.user_id).';

NOTIFY pgrst, 'reload schema';
