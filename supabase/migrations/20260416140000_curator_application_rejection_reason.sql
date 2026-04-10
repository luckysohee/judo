-- 반려 사유 컬럼 + reject_curator_application(application_id, p_reason 기본 NULL)

ALTER TABLE public.curator_applications
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.curator_applications.rejection_reason IS
  '관리자 반려 시 사유(선택). 사용자 알림·관리자 목록에 표시.';

DROP FUNCTION IF EXISTS public.reject_curator_application(uuid);
DROP FUNCTION IF EXISTS public.reject_curator_application(uuid, text);

CREATE OR REPLACE FUNCTION public.reject_curator_application(
  application_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.curator_applications
  SET
    status = 'rejected',
    rejection_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE id = application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_curator_application(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_curator_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_curator_application(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
