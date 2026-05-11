-- 컬렉션 소유자가 자기 코스의 interaction 로그를 집계할 수 있게 SELECT 정책 추가.
-- (개별 user_id 공개 의도는 아니지만 row 자체는 보이므로, UI 는 count 만 사용한다.)
DROP POLICY IF EXISTS "Owner can view their collection interaction logs"
  ON public.collection_interaction_logs;
CREATE POLICY "Owner can view their collection interaction logs"
  ON public.collection_interaction_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_interaction_logs.collection_id
        AND c.user_id = auth.uid()
    )
  );
