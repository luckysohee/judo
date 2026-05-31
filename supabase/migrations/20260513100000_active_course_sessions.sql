-- 사용자별 "코스 따라가기" 진행 세션 (MVP: 상태 뼈대만, 완주/랭킹/GPS 없음)

CREATE TABLE IF NOT EXISTS public.active_course_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.curator_courses (id) ON DELETE CASCADE,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  CONSTRAINT active_course_sessions_step_nonnegative_check
    CHECK (current_step_index >= 0),
  CONSTRAINT active_course_sessions_completed_xor_abandoned_check
    CHECK (NOT (completed_at IS NOT NULL AND abandoned_at IS NOT NULL))
);

COMMENT ON TABLE public.active_course_sessions IS
  '공개 코스 따라가기 진행 세션. 사용자당 동시에 하나의 active 세션만 (completed/abandoned 가 아닌 행). 체크인 연동은 추후.';

CREATE UNIQUE INDEX IF NOT EXISTS active_course_sessions_one_active_per_user
  ON public.active_course_sessions (user_id)
  WHERE completed_at IS NULL AND abandoned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_active_course_sessions_user_id
  ON public.active_course_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_active_course_sessions_course_id
  ON public.active_course_sessions (course_id);

CREATE INDEX IF NOT EXISTS idx_active_course_sessions_active_by_user
  ON public.active_course_sessions (user_id)
  WHERE completed_at IS NULL AND abandoned_at IS NULL;

CREATE OR REPLACE FUNCTION public.active_course_sessions_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS active_course_sessions_touch_updated_at_trg
  ON public.active_course_sessions;
CREATE TRIGGER active_course_sessions_touch_updated_at_trg
  BEFORE UPDATE ON public.active_course_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.active_course_sessions_touch_updated_at();

ALTER TABLE public.active_course_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active_course_sessions_select_own" ON public.active_course_sessions;
CREATE POLICY "active_course_sessions_select_own"
  ON public.active_course_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "active_course_sessions_select_own" ON public.active_course_sessions IS
  '본인 세션만 조회.';

DROP POLICY IF EXISTS "active_course_sessions_insert_own" ON public.active_course_sessions;
CREATE POLICY "active_course_sessions_insert_own"
  ON public.active_course_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "active_course_sessions_insert_own" ON public.active_course_sessions IS
  '본인 user_id 로만 생성.';

DROP POLICY IF EXISTS "active_course_sessions_update_own" ON public.active_course_sessions;
CREATE POLICY "active_course_sessions_update_own"
  ON public.active_course_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "active_course_sessions_update_own" ON public.active_course_sessions IS
  '본인 세션만 갱신(단계 이동·완주·중단).';

REVOKE ALL ON TABLE public.active_course_sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.active_course_sessions TO authenticated;

NOTIFY pgrst, 'reload schema';
