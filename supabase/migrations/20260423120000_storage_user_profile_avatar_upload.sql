-- storage.objects 소유권: Supabase 호스팅에서는 보통 postgres(대시보드 SQL Editor)만 정책 변경 가능.
-- `must be owner of relation objects`(42501) 나오면: TablePlus·pooler 일반 역할이 아니라
-- Dashboard → SQL Editor 에서 이 파일 전체를 붙여넣어 실행하세요.

-- 일반 유저도 자기 UID 폴더의 profile/ 하위에만 업로드 가능 (큐레이터와 동일 버킷·경로 규칙)
DROP POLICY IF EXISTS "curator_photos_insert_own_folder" ON storage.objects;
CREATE POLICY "curator_photos_insert_own_folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'curator-place-photos'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND (
      EXISTS (SELECT 1 FROM public.curators c WHERE c.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
      OR split_part(name, '/', 2) = 'profile'
    )
  );
