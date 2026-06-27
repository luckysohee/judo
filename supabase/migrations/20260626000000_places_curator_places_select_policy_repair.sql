-- 스튜디오 잔리스트 공백 복구: places / curator_places 에 RLS 가 켜졌는데
-- SELECT 정책이 없으면 클라이언트 직접 조회가 전부 빈 결과가 된다.
-- (홈 지도는 service_role RPC 라 RLS 우회 → 영향 없음)
-- SELECT 공개 정책을 idempotent 하게 재보장한다.

DROP POLICY IF EXISTS "places_select_public" ON public.places;
CREATE POLICY "places_select_public"
  ON public.places
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "curator_places_select_public" ON public.curator_places;
CREATE POLICY "curator_places_select_public"
  ON public.curator_places
  FOR SELECT
  TO anon, authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
