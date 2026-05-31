-- 코스 장소별 도장(여권) — 한잔함으로 인증, 모두 모이면 완주

CREATE TABLE IF NOT EXISTS public.course_place_stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.curator_courses (id) ON DELETE CASCADE,
  place_id UUID NOT NULL,
  order_index INTEGER NOT NULL,
  stamped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT course_place_stamps_order_nonnegative_check
    CHECK (order_index >= 0)
);

COMMENT ON TABLE public.course_place_stamps IS
  '공개 코스 장소별 도장. 순서 무관 수집 가능 — 전부 모이면 앱에서 완주 처리.';

CREATE UNIQUE INDEX IF NOT EXISTS course_place_stamps_user_course_place
  ON public.course_place_stamps (user_id, course_id, place_id);

CREATE INDEX IF NOT EXISTS idx_course_place_stamps_user_course
  ON public.course_place_stamps (user_id, course_id, order_index);

ALTER TABLE public.course_place_stamps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_place_stamps_select_own" ON public.course_place_stamps;
CREATE POLICY "course_place_stamps_select_own"
  ON public.course_place_stamps
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "course_place_stamps_insert_own" ON public.course_place_stamps;
CREATE POLICY "course_place_stamps_insert_own"
  ON public.course_place_stamps
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.course_place_stamps FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.course_place_stamps TO authenticated;

DROP POLICY IF EXISTS "course_place_stamps_delete_own" ON public.course_place_stamps;
CREATE POLICY "course_place_stamps_delete_own"
  ON public.course_place_stamps
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
