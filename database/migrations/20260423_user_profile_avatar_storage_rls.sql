-- 일반 유저: curator-place-photos 버킷에서 {uid}/profile/* 만 INSERT 허용
-- Supabase: storage.objects 는 대시보드 SQL Editor(postgres)에서 실행해야 할 수 있음 (42501 방지).

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
