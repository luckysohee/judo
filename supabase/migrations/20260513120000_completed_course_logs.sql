-- 코스 완주 영구 기록 (active_course_sessions 는 진행·종료 상태용, 본 테이블은 아카이브·통계 확장용)
-- 세션과 분리: 코스 삭제·RLS 이후에도 스냅샷 유지

CREATE TABLE IF NOT EXISTS public.completed_course_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- active_course_sessions 선행 적용 전에도 마이그레이션 가능하도록 FK 없음(앱에서 session id만 기록)
  session_id UUID,
  course_id UUID REFERENCES public.curator_courses (id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  place_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT completed_course_logs_place_count_nonnegative_check
    CHECK (place_count >= 0),
  course_title TEXT NOT NULL,
  course_cover_image_url TEXT,
  curator_id UUID,
  curator_display_name TEXT,
  duration_seconds INTEGER,
  CONSTRAINT completed_course_logs_duration_nonnegative_check
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

COMMENT ON TABLE public.completed_course_logs IS
  '사용자 코스 완주 스냅샷. 통계·피드·공유 확장 시 세션 테이블과 독립적으로 집계.';

CREATE UNIQUE INDEX IF NOT EXISTS completed_course_logs_one_per_session
  ON public.completed_course_logs (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_completed_course_logs_user_completed
  ON public.completed_course_logs (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_completed_course_logs_course
  ON public.completed_course_logs (course_id)
  WHERE course_id IS NOT NULL;

ALTER TABLE public.completed_course_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "completed_course_logs_select_own" ON public.completed_course_logs;
CREATE POLICY "completed_course_logs_select_own"
  ON public.completed_course_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "completed_course_logs_select_own" ON public.completed_course_logs IS
  '본인 완주 기록만 조회.';

DROP POLICY IF EXISTS "completed_course_logs_insert_own" ON public.completed_course_logs;
CREATE POLICY "completed_course_logs_insert_own"
  ON public.completed_course_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "completed_course_logs_insert_own" ON public.completed_course_logs IS
  '본인 user_id 로만 삽입.';

REVOKE ALL ON TABLE public.completed_course_logs FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE public.completed_course_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
