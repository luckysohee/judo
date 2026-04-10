-- 큐레이터 본인이 자신의 curators 행을 수정할 수 있게 함 (프로필 사진·소개 등)
-- 기존 "Admins can update curator grade and status" 와 병행: permissive 정책은 OR 로 결합됩니다.
ALTER TABLE curators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Curators can update own row" ON curators;
CREATE POLICY "Curators can update own row"
  ON curators
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
