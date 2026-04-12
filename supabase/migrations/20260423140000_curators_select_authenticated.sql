-- 팔로워 목록·토스트 등: 로그인 사용자가 다른 큐레이터 행을 읽을 수 있어야
-- display_name / username / slug 로 "별명 (@핸들)" 표시 가능 (RLS로 막히면 profiles 본명만 보임)
-- 이미 SELECT가 열려 있으면 중복 정책은 OR로 합쳐짐

DROP POLICY IF EXISTS "curators_select_authenticated" ON public.curators;
CREATE POLICY "curators_select_authenticated"
  ON public.curators
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "curators_select_authenticated" ON public.curators IS
  '스튜디오 팔로워 등: 인증 사용자는 큐레이터 공개 프로필 행 조회';

NOTIFY pgrst, 'reload schema';
