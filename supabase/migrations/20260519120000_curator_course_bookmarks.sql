-- 공개 잔 코스 즐겨찾기(북마크) — 원본 복제·편집 없음

CREATE TABLE IF NOT EXISTS public.curator_course_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.curator_courses (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_course_bookmarks_user_course_unique UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_curator_course_bookmarks_user_created
  ON public.curator_course_bookmarks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_curator_course_bookmarks_course_created
  ON public.curator_course_bookmarks (course_id, created_at DESC);

COMMENT ON TABLE public.curator_course_bookmarks IS
  '사용자가 공개 코스를 나중에 다시 볼 목록에 저장(원본 편집·복제 아님).';

ALTER TABLE public.curator_course_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curator_course_bookmarks_select_own" ON public.curator_course_bookmarks;
CREATE POLICY "curator_course_bookmarks_select_own"
  ON public.curator_course_bookmarks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "curator_course_bookmarks_insert_public_course" ON public.curator_course_bookmarks;
CREATE POLICY "curator_course_bookmarks_insert_public_course"
  ON public.curator_course_bookmarks FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.curator_courses c
      WHERE c.id = course_id
        AND c.status = 'published'
        AND c.is_public = true
    )
  );

DROP POLICY IF EXISTS "curator_course_bookmarks_delete_own" ON public.curator_course_bookmarks;
CREATE POLICY "curator_course_bookmarks_delete_own"
  ON public.curator_course_bookmarks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.curator_course_bookmarks FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.curator_course_bookmarks TO authenticated;

NOTIFY pgrst, 'reload schema';
