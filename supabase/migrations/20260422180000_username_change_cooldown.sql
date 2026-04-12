-- profiles·curators: 핸들(username) 변경 14일 쿨다운 (인스타그램 유사)
-- 빈 핸들로 바꾼 뒤 다시 설정하는 우회 방지: username_changed_at은 비울 때 유지

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

COMMENT ON COLUMN public.profiles.username_changed_at IS
  '핸들(username) 마지막으로 바뀐 시각(UTC). 14일 쿨다운 기준.';

ALTER TABLE public.curators
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

COMMENT ON COLUMN public.curators.username_changed_at IS
  '핸들(username) 마지막으로 바뀐 시각(UTC). 14일 쿨다운 기준.';

CREATE OR REPLACE FUNCTION public.enforce_username_change_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $f$
DECLARE
  old_u text;
  new_u text;
  next_ok timestamptz;
  cooldown constant interval := interval '14 days';
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_u := lower(btrim(COALESCE(NEW.username, '')));
    IF new_u <> '' THEN
      NEW.username_changed_at := timezone('utc', now());
    ELSE
      NEW.username_changed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_u := lower(btrim(COALESCE(OLD.username, '')));
    new_u := lower(btrim(COALESCE(NEW.username, '')));

    IF old_u IS NOT DISTINCT FROM new_u THEN
      RETURN NEW;
    END IF;

    IF OLD.username_changed_at IS NOT NULL
       AND timezone('utc', now()) < OLD.username_changed_at + cooldown THEN
      next_ok := OLD.username_changed_at + cooldown;
      RAISE EXCEPTION
        '핸들(@고유이름)은 14일에 한 번만 바꿀 수 있습니다. 다음 변경 가능: %.',
        to_char(next_ok AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
        USING ERRCODE = 'P0001';
    END IF;

    IF new_u = '' THEN
      NEW.username_changed_at := OLD.username_changed_at;
    ELSE
      NEW.username_changed_at := timezone('utc', now());
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS tr_profiles_username_cooldown_ins ON public.profiles;
CREATE TRIGGER tr_profiles_username_cooldown_ins
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_change_cooldown();

DROP TRIGGER IF EXISTS tr_profiles_username_cooldown_upd ON public.profiles;
CREATE TRIGGER tr_profiles_username_cooldown_upd
  BEFORE UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_change_cooldown();

DROP TRIGGER IF EXISTS tr_curators_username_cooldown_ins ON public.curators;
CREATE TRIGGER tr_curators_username_cooldown_ins
  BEFORE INSERT ON public.curators
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_change_cooldown();

DROP TRIGGER IF EXISTS tr_curators_username_cooldown_upd ON public.curators;
CREATE TRIGGER tr_curators_username_cooldown_upd
  BEFORE UPDATE OF username ON public.curators
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_change_cooldown();

COMMENT ON FUNCTION public.enforce_username_change_cooldown() IS
  'profiles·curators: username 값이 바뀔 때 14일 쿨다운.';

NOTIFY pgrst, 'reload schema';
