-- 큐레이터 전용 장소 사진 (카카오 장소 ID 또는 places.id 연동)
-- Supabase SQL Editor에서 실행 후 Storage 버킷 정책이 적용되는지 확인하세요.

CREATE TABLE IF NOT EXISTS curator_place_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kakao_place_id TEXT,
  place_id UUID REFERENCES places (id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_place_photos_target_chk CHECK (
    kakao_place_id IS NOT NULL OR place_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_curator_place_photos_kakao
  ON curator_place_photos (kakao_place_id)
  WHERE kakao_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_curator_place_photos_place
  ON curator_place_photos (place_id)
  WHERE place_id IS NOT NULL;

ALTER TABLE curator_place_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curator_place_photos_select_all" ON curator_place_photos;
CREATE POLICY "curator_place_photos_select_all"
  ON curator_place_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "curator_place_photos_insert_curator" ON curator_place_photos;
CREATE POLICY "curator_place_photos_insert_curator"
  ON curator_place_photos FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = curator_id
    AND (
      EXISTS (SELECT 1 FROM curators c WHERE c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "curator_place_photos_delete_own" ON curator_place_photos;
CREATE POLICY "curator_place_photos_delete_own"
  ON curator_place_photos FOR DELETE
  USING (auth.uid() = curator_id);

-- Storage: 공개 읽기, 업로드는 인증 + (큐레이터 또는 관리자), 경로 첫 세그먼트 = auth.uid()
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'curator-place-photos',
  'curator-place-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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
