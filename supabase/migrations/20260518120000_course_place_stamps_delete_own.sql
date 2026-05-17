-- 다시 모으기: 본인 도장만 삭제

DROP POLICY IF EXISTS "course_place_stamps_delete_own" ON public.course_place_stamps;
CREATE POLICY "course_place_stamps_delete_own"
  ON public.course_place_stamps
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT DELETE ON TABLE public.course_place_stamps TO authenticated;

NOTIFY pgrst, 'reload schema';
