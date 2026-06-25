-- curators: relrowsecurity=false → 누구나 INSERT/UPDATE/DELETE 가능했음.
-- SELECT 정책(anon·authenticated)은 이미 있으나 RLS 미활성으로 무의미했음.
-- RLS 활성화 + 쓰기 정책 + grade/status 등 운영 필드 자기변경 차단 트리거.

ALTER TABLE public.curators ENABLE ROW LEVEL SECURITY;

-- ── SELECT (기존 정책 재확인, idempotent) ──────────────────────────────────
DROP POLICY IF EXISTS "curators_select_authenticated" ON public.curators;
CREATE POLICY "curators_select_authenticated"
  ON public.curators
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "curators_select_anon_public" ON public.curators;
CREATE POLICY "curators_select_anon_public"
  ON public.curators
  FOR SELECT
  TO anon
  USING (true);

-- ── INSERT: 관리자만 (승인 RPC는 SECURITY DEFINER 로 RLS 우회) ─────────────
DROP POLICY IF EXISTS "curators_insert_admin" ON public.curators;
CREATE POLICY "curators_insert_admin"
  ON public.curators
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── UPDATE: 본인 행 (프로필·활동 카운터) ────────────────────────────────────
DROP POLICY IF EXISTS "Curators can update own row" ON public.curators;
DROP POLICY IF EXISTS "curators_update_own" ON public.curators;
CREATE POLICY "curators_update_own"
  ON public.curators
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── UPDATE: 관리자 전체 ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can update curator grade and status" ON public.curators;
DROP POLICY IF EXISTS "curators_update_admin" ON public.curators;
CREATE POLICY "curators_update_admin"
  ON public.curators
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

-- ── DELETE: 관리자만 ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "curators_delete_admin" ON public.curators;
CREATE POLICY "curators_delete_admin"
  ON public.curators
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ── grade/status/warning_count: 비관리자 자기변경 차단 (UPDATE 정책 OR 우회) ─
CREATE OR REPLACE FUNCTION public.prevent_curator_privileged_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged_changed boolean;
BEGIN
  privileged_changed :=
    NEW.grade IS DISTINCT FROM OLD.grade
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.warning_count IS DISTINCT FROM OLD.warning_count;

  IF NOT privileged_changed THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'curator grade/status change not allowed (admin only)';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_curator_privileged_self_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_curator_privileged_self_update ON public.curators;
CREATE TRIGGER trg_prevent_curator_privileged_self_update
  BEFORE UPDATE ON public.curators
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_curator_privileged_self_update();

COMMENT ON FUNCTION public.prevent_curator_privileged_self_update() IS
  'curators.grade/status/warning_count — admin 또는 service_role 만 변경 가능';

NOTIFY pgrst, 'reload schema';
