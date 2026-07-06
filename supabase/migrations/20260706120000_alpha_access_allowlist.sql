-- 클로즈드 알파: 초대 이메일 allowlist + RPC (프론트·서버 게이트)

CREATE TABLE IF NOT EXISTS public.alpha_access_allowlist (
  email text PRIMARY KEY,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.alpha_access_allowlist IS
  '클로즈드 알파 초대 이메일. 소문자로 정규화되어 저장됩니다.';

CREATE OR REPLACE FUNCTION public.normalize_alpha_allowlist_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alpha_allowlist_email_norm ON public.alpha_access_allowlist;
CREATE TRIGGER trg_alpha_allowlist_email_norm
  BEFORE INSERT OR UPDATE ON public.alpha_access_allowlist
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_alpha_allowlist_email();

ALTER TABLE public.alpha_access_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alpha_access_allowlist_admin_all ON public.alpha_access_allowlist;
CREATE POLICY alpha_access_allowlist_admin_all
  ON public.alpha_access_allowlist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.check_alpha_access_allowed()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  IF v_email = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.alpha_access_allowlist a
    WHERE a.email = v_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_alpha_access_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_alpha_access_allowed() TO authenticated;

-- 초대 등록 예시 (실제 이메일로 교체 후 실행):
-- INSERT INTO public.alpha_access_allowlist (email, label) VALUES
--   ('friend@gmail.com', '지인 A'),
--   ('tester@kakao.com', '지인 B')
-- ON CONFLICT (email) DO NOTHING;
