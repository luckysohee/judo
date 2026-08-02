-- 홈 큐레이터 칩 표시 순서 (작을수록 앞). 관리자 UI에서 조정.

ALTER TABLE public.curators
  ADD COLUMN IF NOT EXISTS home_chip_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.curators.home_chip_order IS
  '홈 큐레이터 칩 표시 순서(작을수록 앞). 관리자만 변경.';

-- 기존 칩 순서(created_at DESC)를 초기값으로 보존
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC NULLS LAST, id ASC) AS rn
  FROM public.curators
)
UPDATE public.curators c
SET home_chip_order = ranked.rn
FROM ranked
WHERE c.id = ranked.id
  AND COALESCE(c.home_chip_order, 0) = 0;

CREATE INDEX IF NOT EXISTS curators_home_chip_order_idx
  ON public.curators (home_chip_order ASC, created_at DESC);

-- grade/status와 같이 비관리자 자기변경 차단
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
    OR NEW.home_chip_order IS DISTINCT FROM OLD.home_chip_order;

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
  'grade/status/warning_count/home_chip_order 비관리자 변경 차단';
