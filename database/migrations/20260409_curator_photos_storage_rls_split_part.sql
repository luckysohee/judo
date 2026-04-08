-- 이미 20260408 마이그레이션을 실행했다면: storage.foldername 이 없거나 업로드가 막히는 경우 이 스크립트만 추가 실행.
-- 경로 첫 세그먼트 = auth.uid() 검사를 split_part 로 통일.

DROP POLICY IF EXISTS "curator_photos_insert_own_folder" ON storage.objects;
CREATE POLICY "curator_photos_insert_own_folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'curator-place-photos'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND (
      EXISTS (SELECT 1 FROM curators c WHERE c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "curator_photos_delete_own" ON storage.objects;
CREATE POLICY "curator_photos_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'curator-place-photos'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
