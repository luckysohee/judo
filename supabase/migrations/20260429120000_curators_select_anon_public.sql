-- 홈 지도: curator_places 조인 시 curators(username, display_name) 임베드가
-- RLS 때문에 비로그인(anon)에서 전부 null → 큐레이터 칩 필터가 영원히 안 맞음.
-- 공개 프로필 필드만 노출 목적: 큐레이터 행 전체 SELECT 허용 (이미 authenticated 에 true).

DROP POLICY IF EXISTS "curators_select_anon_public" ON public.curators;
CREATE POLICY "curators_select_anon_public"
  ON public.curators
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "curators_select_anon_public" ON public.curators IS
  '비로그인 홈: curator_places→curators 조인으로 username/display_name 표시';

NOTIFY pgrst, 'reload schema';
