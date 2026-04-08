-- =============================================================================
-- curator_place_photos 테이블이 없으면 먼저 20260408_curator_place_photos.sql 실행
-- "Bucket not found" / Storage 400 해결용
-- Supabase → SQL Editor → 전체 실행 (한 번만)
-- 또는 Dashboard → Storage → New bucket → Name: curator-place-photos → Public ✓
--
-- allowed_mime_types 컬럼 오류 시 아래 INSERT만 (id, name, public) 세 컬럼으로 바꿔 실행:
-- INSERT INTO storage.buckets (id, name, public) VALUES (...) ON CONFLICT (id) DO UPDATE SET public = true;
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'curator-place-photos',
  'curator-place-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 아래 정책은 20260408 / 20260409 에 없다면 함께 적용
DROP POLICY IF EXISTS "curator_photos_public_read" ON storage.objects;
CREATE POLICY "curator_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'curator-place-photos');

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
