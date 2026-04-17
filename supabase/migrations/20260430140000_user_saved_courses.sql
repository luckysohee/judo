-- 홈 코스 모드「나만의 코스」저장 (1차·2차 스냅샷 JSON)

CREATE TABLE IF NOT EXISTS public.user_saved_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  pair_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '나만의 코스',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_course_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_saved_courses_pair_unique UNIQUE (user_id, pair_key)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_courses_user_created
  ON public.user_saved_courses (user_id, created_at DESC);

COMMENT ON TABLE public.user_saved_courses IS
  '코스 모드에서 저장한 나만의 코스(1·2차 장소 스냅샷); pair_key로 동일 조합 중복 방지';

ALTER TABLE public.user_saved_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_saved_courses_select_own" ON public.user_saved_courses;
CREATE POLICY "user_saved_courses_select_own"
  ON public.user_saved_courses FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_courses_insert_own" ON public.user_saved_courses;
CREATE POLICY "user_saved_courses_insert_own"
  ON public.user_saved_courses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_courses_delete_own" ON public.user_saved_courses;
CREATE POLICY "user_saved_courses_delete_own"
  ON public.user_saved_courses FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON TABLE public.user_saved_courses TO authenticated;
