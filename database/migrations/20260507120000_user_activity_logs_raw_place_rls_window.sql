-- Mirror of supabase/migrations/20260507120000_user_activity_logs_raw_place_rls_window.sql

ALTER TABLE public.user_activity_logs
  DROP CONSTRAINT IF EXISTS user_activity_logs_check_place_or_raw;

ALTER TABLE public.user_activity_logs
  ALTER COLUMN place_id DROP NOT NULL;

ALTER TABLE public.user_activity_logs
  ADD COLUMN IF NOT EXISTS raw_place_name text,
  ADD COLUMN IF NOT EXISTS raw_address text;

UPDATE public.user_activity_logs AS u
SET raw_place_name = left(trim(COALESCE(p.name, '')), 500)
FROM public.places AS p
WHERE u.place_id IS NOT NULL
  AND p.id = u.place_id
  AND (u.raw_place_name IS NULL OR btrim(u.raw_place_name) = '');

UPDATE public.user_activity_logs
SET raw_place_name = left(trim(coalesce(raw_place_name, '')), 500);

UPDATE public.user_activity_logs
SET raw_place_name = '근처 술집'
WHERE length(btrim(coalesce(raw_place_name, ''))) = 0;

ALTER TABLE public.user_activity_logs
  ALTER COLUMN raw_place_name SET NOT NULL;

ALTER TABLE public.user_activity_logs
  ADD CONSTRAINT user_activity_logs_check_place_or_raw
  CHECK (
    place_id IS NOT NULL
    OR length(btrim(raw_place_name)) > 0
  );

CREATE INDEX IF NOT EXISTS idx_uact_checkin_place_null_user_created
  ON public.user_activity_logs (user_id, created_at DESC)
  WHERE type = 'checkin' AND place_id IS NULL;

DROP POLICY IF EXISTS "user_activity_logs_select_block" ON public.user_activity_logs;
DROP POLICY IF EXISTS "user_activity_logs_select_own_or_mutual_checkin" ON public.user_activity_logs;
CREATE POLICY "user_activity_logs_select_own_or_mutual_checkin"
  ON public.user_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    type = 'checkin'
    AND (
      user_id = auth.uid()
      OR user_activity_logs.user_id IN (
          SELECT mu.user_id FROM public.get_mutual_users() AS mu
        )
    )
  );

COMMENT ON COLUMN public.user_activity_logs.raw_place_name IS
  '표시용 장소 라벨(check_ins 이름 등). places 미매칭 시 필수.';
COMMENT ON COLUMN public.user_activity_logs.raw_address IS
  '선택: check_ins.place_address 스냅샷';

CREATE OR REPLACE FUNCTION public.log_checkin_user_activity_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  ts timestamptz;
  pname text;
  paddr text;
  pname_from_place text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  ts := COALESCE(NEW.created_at, timezone('utc', now()));

  pname := trim(COALESCE(NEW.place_name, ''));
  paddr := left(trim(COALESCE(NEW.place_address, '')), 500);

  pid := public.resolve_places_uuid_from_check_ins_place_id(NEW.place_id::text);

  IF pid IS NOT NULL THEN
    IF pname = '' THEN
      SELECT trim(COALESCE(p.name::text, '')) INTO pname_from_place
      FROM public.places p
      WHERE p.id = pid
      LIMIT 1;
      pname := COALESCE(NULLIF(pname_from_place, ''), pname);
    END IF;
  END IF;

  IF pname = '' THEN
    pname := trim(COALESCE(NEW.place_id::text, ''));
  END IF;
  IF pname = '' THEN
    pname := '근처 술집';
  END IF;

  pname := left(pname, 500);

  IF pid IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_activity_logs u
      WHERE u.user_id = NEW.user_id
        AND u.type = 'checkin'
        AND u.place_id IS NOT DISTINCT FROM pid
        AND u.created_at >= ts - INTERVAL '2 hours'
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.user_activity_logs (
      user_id,
      type,
      place_id,
      raw_place_name,
      raw_address,
      created_at
    )
    VALUES (
      NEW.user_id,
      'checkin',
      pid,
      pname,
      NULLIF(paddr, ''),
      ts
    );
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_activity_logs u
    WHERE u.user_id = NEW.user_id
      AND u.type = 'checkin'
      AND u.place_id IS NULL
      AND left(btrim(lower(COALESCE(u.raw_place_name, ''))), 400)
        = left(btrim(lower(pname)), 400)
      AND u.created_at >= ts - INTERVAL '2 hours'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_activity_logs (
    user_id,
    type,
    place_id,
    raw_place_name,
    raw_address,
    created_at
  )
  VALUES (
    NEW.user_id,
    'checkin',
    NULL,
    pname,
    NULLIF(paddr, ''),
    ts
  );

  RETURN NEW;
END;
$$;

-- 반환 타입(OUT) 바뀌면 OR REPLACE 불가 → ROUTINE 인자 문자열까지 맞춰 전부 DROP
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS sch,
      p.proname AS nam,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS argtxt
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'get_mutual_checkins'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'DROP ROUTINE IF EXISTS %I.%I(%s) CASCADE',
      r.sch,
      r.nam,
      r.argtxt
    );
  END LOOP;
END $$;

CREATE FUNCTION public.get_mutual_checkins(limit_count integer DEFAULT 24)
RETURNS TABLE (
  user_id uuid,
  place_id uuid,
  raw_place_name text,
  raw_address text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.user_id,
    l.place_id,
    l.raw_place_name,
    l.raw_address,
    l.created_at
  FROM public.user_activity_logs l
  WHERE l.type = 'checkin'
    AND (auth.uid() IS NOT NULL)
    AND l.user_id IN (
      SELECT m.user_id FROM public.get_mutual_users() AS m
    )
    AND l.created_at > timezone('utc', now()) - INTERVAL '12 hours'
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(NULLIF(limit_count, 0), 24), 30));
$$;

REVOKE ALL ON FUNCTION public.get_mutual_checkins(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mutual_checkins(integer) TO authenticated;

COMMENT ON FUNCTION public.get_mutual_checkins(integer) IS
  '맞픽 유저 최근 12시간 한잔 로그. limit 기본 24, 상한 30.';

NOTIFY pgrst, 'reload schema';
