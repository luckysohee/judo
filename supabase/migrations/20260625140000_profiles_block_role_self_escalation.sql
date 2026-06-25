-- 🔴 권한 상승 차단: judo_profiles_update_own 정책은 본인 행의 모든 컬럼 수정을 허용해
-- 일반 사용자가 self로 role='admin' 을 설정할 수 있었다. role 변경은 admin(또는 서버
-- service_role)만 가능하도록 BEFORE UPDATE 트리거로 강제한다. (닉네임·아바타 등 다른
-- 컬럼은 기존대로 본인 수정 가능)

CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- role 변경이 없으면 통과 (닉네임·아바타 등 일반 수정)
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- 서버(service_role) 또는 JWT 없는 신뢰 컨텍스트 → 허용
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 그 외에는 호출자가 admin 일 때만 role 변경 허용
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'role change not allowed (admin only)';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_role_self_escalation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_self_escalation();

COMMENT ON FUNCTION public.prevent_profile_role_self_escalation() IS
  'profiles.role 자기승격 차단 — admin 또는 service_role 만 role 변경 가능';

NOTIFY pgrst, 'reload schema';
