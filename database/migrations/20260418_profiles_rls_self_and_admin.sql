-- profiles PATCH 403: RLS 본인 UPDATE/INSERT·관리자 UPDATE·조회
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "judo_profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "judo_profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "judo_profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "judo_profiles_update_admin" ON public.profiles;

CREATE POLICY "judo_profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "judo_profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "judo_profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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
