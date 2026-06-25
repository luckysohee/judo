-- curator_applications: anon allow insert/select/update 레거시 제거 (PII 유출·자기승인)
-- approve_curator_application: admin 검사 없음 → admin only 가드 추가

-- ── 레거시 정책 제거 ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow insert" ON public.curator_applications;
DROP POLICY IF EXISTS "allow select" ON public.curator_applications;
DROP POLICY IF EXISTS "allow update curator_applications" ON public.curator_applications;

-- ── 정책 재확인 (idempotent) ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "curator_applications_select_own" ON public.curator_applications;
CREATE POLICY "curator_applications_select_own"
  ON public.curator_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "curator_applications_select_admin" ON public.curator_applications;
CREATE POLICY "curator_applications_select_admin"
  ON public.curator_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "curator_applications_insert_own" ON public.curator_applications;
CREATE POLICY "curator_applications_insert_own"
  ON public.curator_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "curator_applications_update_admin" ON public.curator_applications;
CREATE POLICY "curator_applications_update_admin"
  ON public.curator_applications
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

DROP POLICY IF EXISTS "curator_applications_delete_admin" ON public.curator_applications;
CREATE POLICY "curator_applications_delete_admin"
  ON public.curator_applications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── 승인 RPC: admin only (기존 본문 + 가드) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_curator_application(application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  applicant_user_id uuid;
  applicant_name text;
  curator_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT user_id, name
  INTO applicant_user_id, applicant_name
  FROM public.curator_applications
  WHERE id = application_id
    AND status = 'pending';

  IF applicant_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already processed application';
  END IF;

  curator_slug := lower(
    regexp_replace(COALESCE(applicant_name, 'curator'), '[^a-z0-9가-힣]+', '_', 'g')
  );
  IF curator_slug = '' OR curator_slug = '_' THEN
    curator_slug := 'curator_' || left(replace(applicant_user_id::text, '-', ''), 8);
  END IF;

  -- profiles.role 은 바꾸지 않고 curators 행만 추가/갱신
  INSERT INTO public.curators (user_id, name, display_name, slug)
  VALUES (
    applicant_user_id,
    applicant_name,
    applicant_name,
    curator_slug
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    slug = EXCLUDED.slug,
    updated_at = now();

  UPDATE public.curator_applications
  SET
    status = 'approved',
    updated_at = now()
  WHERE id = application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_curator_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_curator_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_curator_application(uuid) TO service_role;

COMMENT ON FUNCTION public.approve_curator_application(uuid) IS
  '관리자만: pending 신청 승인 → curators 행 upsert (profiles.role 미변경)';

NOTIFY pgrst, 'reload schema';
