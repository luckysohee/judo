-- 감사 로그 서버 트리거 (Supabase 동기: supabase/migrations/20260421120000_admin_audit_server_triggers.sql)

CREATE OR REPLACE FUNCTION public.admin_audit_log_insert_definer(
  p_actor_id uuid,
  p_action text,
  p_target_user_id uuid,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
BEGIN
  IF p_actor_id IS NULL OR p_action IS NULL OR btrim(p_action) = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, meta)
  VALUES (
    p_actor_id,
    btrim(p_action),
    p_target_user_id,
    COALESCE(p_meta, '{}'::jsonb)
  );
END;
$f$;

REVOKE ALL ON FUNCTION public.admin_audit_log_insert_definer(uuid, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_audit_log_insert_definer(uuid, text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.admin_audit_log_insert_definer(uuid, text, uuid, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_audit_log_insert_definer(uuid, text, uuid, jsonb) FROM service_role;

CREATE OR REPLACE FUNCTION public.trg_audit_curator_applications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = actor AND pr.role = 'admin'
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.admin_audit_log_insert_definer(
      actor,
      'application_deleted',
      OLD.user_id,
      jsonb_build_object(
        'application_id', OLD.id,
        'name', OLD.name,
        'was_approved', (OLD.status = 'approved')
      )
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.admin_audit_log_insert_definer(
        actor,
        'application_approved',
        NEW.user_id,
        jsonb_build_object(
          'application_id', NEW.id,
          'name', NEW.name
        )
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.admin_audit_log_insert_definer(
        actor,
        'application_rejected',
        NEW.user_id,
        jsonb_build_object(
          'application_id', NEW.id,
          'name', NEW.name,
          'reason', NEW.rejection_reason
        )
      );
    ELSIF NEW.status = 'pending' AND OLD.status = 'approved' THEN
      PERFORM public.admin_audit_log_insert_definer(
        actor,
        'application_revoke_curator',
        NEW.user_id,
        jsonb_build_object(
          'application_id', NEW.id,
          'name', NEW.name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS trg_audit_curator_applications_row ON public.curator_applications;
CREATE TRIGGER trg_audit_curator_applications_row
  AFTER UPDATE OR DELETE ON public.curator_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_curator_applications();

CREATE OR REPLACE FUNCTION public.trg_audit_curators_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = actor AND pr.role = 'admin'
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.admin_audit_log_insert_definer(
      actor,
      'curator_revoked',
      OLD.user_id,
      jsonb_build_object('username', OLD.username)
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.grade IS DISTINCT FROM NEW.grade THEN
      PERFORM public.admin_audit_log_insert_definer(
        actor,
        'curator_grade_changed',
        NEW.user_id,
        jsonb_build_object('from', OLD.grade, 'to', NEW.grade)
      );
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.admin_audit_log_insert_definer(
        actor,
        'curator_status_changed',
        NEW.user_id,
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS trg_audit_curators_admin_row ON public.curators;
CREATE TRIGGER trg_audit_curators_admin_row
  AFTER UPDATE OR DELETE ON public.curators
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_curators_admin();

CREATE OR REPLACE FUNCTION public.trg_audit_grade_review_dismissed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = actor AND pr.role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.resolved_at IS NULL
     AND NEW.resolved_at IS NOT NULL
     AND NEW.resolved_action = 'dismissed' THEN
    PERFORM public.admin_audit_log_insert_definer(
      actor,
      'grade_review_dismissed',
      NEW.curator_user_id,
      jsonb_build_object(
        'queue_id', NEW.id,
        'via', 'queue'
      )
    );
  END IF;

  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS trg_audit_grade_review_dismissed_row ON public.curator_grade_review_queue;
CREATE TRIGGER trg_audit_grade_review_dismissed_row
  AFTER UPDATE OF resolved_at, resolved_action ON public.curator_grade_review_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_grade_review_dismissed();
