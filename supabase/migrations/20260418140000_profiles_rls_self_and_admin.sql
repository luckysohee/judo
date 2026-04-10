-- profiles PATCH 403: RLS에 본인 UPDATE/INSERT·관리자 UPDATE·조회 정책 보강
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- idempotent: 이 마이그레이션에서 쓰는 이름만 교체
DROP POLICY IF EXISTS "judo_profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "judo_profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "judo_profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "judo_profiles_update_admin" ON public.profiles;

-- 팔로워 닉네임, 핸들 중복 확인, 관리자 EXISTS 서브쿼리 등: 로그인 사용자 간 프로필 행 읽기
CREATE POLICY "judo_profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 최초 프로필 행 (UserCard insert, syncAuthProviderToProfile insert)
CREATE POLICY "judo_profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 닉네임·핸들·auth_provider 등 본인 행만 수정
CREATE POLICY "judo_profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- AdminApplicationsPage / CuratorManagement: 타인 role 등 갱신
CREATE POLICY "judo_profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
