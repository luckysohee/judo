-- 홈 큐레이터 칩 숨김 (관리자 전용)

ALTER TABLE public.curators
  ADD COLUMN IF NOT EXISTS home_chip_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.curators.home_chip_hidden IS
  'true면 홈 큐레이터 필터 칩에서 숨김. 관리자만 변경.';

CREATE INDEX IF NOT EXISTS curators_home_chip_visible_order_idx
  ON public.curators (home_chip_order ASC, created_at DESC)
  WHERE home_chip_hidden = false;

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
    OR NEW.warning_count IS DISTINCT FROM OLD.warning_count
    OR NEW.home_chip_order IS DISTINCT FROM OLD.home_chip_order
    OR NEW.home_chip_hidden IS DISTINCT FROM OLD.home_chip_hidden;

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

  RAISE EXCEPTION 'curators privileged fields can only be changed by admin'
    USING ERRCODE = '42501';
END;
$$;

COMMENT ON FUNCTION public.prevent_curator_privileged_self_update() IS
  'grade/status/warning_count/home_chip_order/home_chip_hidden 비관리자 변경 차단';
