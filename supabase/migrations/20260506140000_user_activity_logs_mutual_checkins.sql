-- 맞픽(서로 pick) 유저의 최근 체크인 한 줄 노출용: user_activity_logs + 트리거 + get_mutual_users
-- get_mutual_checkins RPC는 20260507120000 전용(반환 컬럼 변경 시 OR REPLACE 금지 → 이 파일에 두지 않음).

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type = 'checkin'),
  place_id uuid NOT NULL REFERENCES public.places (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_type_created_desc
  ON public.user_activity_logs (type, created_at DESC)
  WHERE type = 'checkin';

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_created_desc
  ON public.user_activity_logs (user_id, created_at DESC);

COMMENT ON TABLE public.user_activity_logs IS
  '제품 활동 로그(checkin 등). 소셜 피드 전체 대신 타입별 제한 노출용.';

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 직접 SELECT 차단(get_mutual_checkins RPC SECURITY DEFINER로만 제공).
DROP POLICY IF EXISTS "user_activity_logs_select_block" ON public.user_activity_logs;
CREATE POLICY "user_activity_logs_select_block"
  ON public.user_activity_logs FOR SELECT
  TO authenticated
  USING (false);

-- 트리거 INSERT: 해당 한잔을 남긴 세션 사용자 본인만(= auth.uid())
DROP POLICY IF EXISTS "user_activity_logs_insert_own_checkin_row" ON public.user_activity_logs;
CREATE POLICY "user_activity_logs_insert_own_checkin_row"
  ON public.user_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'checkin'
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "user_activity_logs_modify_block" ON public.user_activity_logs;
CREATE POLICY "user_activity_logs_modify_block"
  ON public.user_activity_logs FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "user_activity_logs_delete_block" ON public.user_activity_logs;
CREATE POLICY "user_activity_logs_delete_block"
  ON public.user_activity_logs FOR DELETE
  TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.resolve_places_uuid_from_check_ins_place_id(p_place_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN btrim(COALESCE(p_place_id, '')) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN btrim(p_place_id)::uuid
    ELSE (
      SELECT p.id
      FROM public.places p
      WHERE btrim(COALESCE(p.kakao_place_id::text, '')) = btrim(COALESCE(p_place_id::text, ''))
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.log_checkin_user_activity_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  ts timestamptz;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  pid := public.resolve_places_uuid_from_check_ins_place_id(NEW.place_id::text);
  IF pid IS NULL THEN
    RETURN NEW;
  END IF;

  ts := COALESCE(NEW.created_at, timezone('utc', now()));

  IF EXISTS (
    SELECT 1
    FROM public.user_activity_logs u
    WHERE u.user_id = NEW.user_id
      AND u.type = 'checkin'
      AND u.place_id = pid
      AND u.created_at >= ts - INTERVAL '2 hours'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_activity_logs (user_id, type, place_id, created_at)
  VALUES (NEW.user_id, 'checkin', pid, ts);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_ins_log_user_activity ON public.check_ins;
CREATE TRIGGER trg_check_ins_log_user_activity
  AFTER INSERT ON public.check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.log_checkin_user_activity_row();

CREATE OR REPLACE FUNCTION public.get_mutual_users()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r1.following_id AS user_id
  FROM public.user_profile_follows r1
  INNER JOIN public.user_profile_follows r2
    ON r1.follower_id = r2.following_id
   AND r1.following_id = r2.follower_id
  WHERE r1.follower_id = auth.uid()
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.resolve_places_uuid_from_check_ins_place_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_checkin_user_activity_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mutual_users() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_mutual_users() TO authenticated;

COMMENT ON FUNCTION public.get_mutual_users() IS
  '세션 사용자와 맞픽(양방향 pick)인 auth uid 목록.';
