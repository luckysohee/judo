-- =============================================================================
-- Tokyo 프로젝트 — DB restore 직후 SQL Editor에서 1회 실행
-- (dump에 storage 정책이 포함돼 있어도 멱등 — 안전하게 재적용)
-- =============================================================================

-- ── 1) Storage bucket: curator-place-photos (장소·프로필·코스커버 공용) ─────
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

-- ── 2) Storage RLS (최신: 큐레이터 + admin + 일반 유저 profile/) ───────────
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
      EXISTS (SELECT 1 FROM public.curators c WHERE c.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
      OR split_part(name, '/', 2) = 'profile'
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

-- ── 3) VERIFY ────────────────────────────────────────────────────────────────
SELECT id, public, file_size_limit
FROM storage.buckets
WHERE id = 'curator-place-photos';

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'curator_photos%'
ORDER BY policyname;
