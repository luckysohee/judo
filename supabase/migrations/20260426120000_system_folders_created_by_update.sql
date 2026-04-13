-- 커스텀 폴더 소유자(created_by) + 본인 행만 UPDATE
-- INSERT 정책에 created_by = auth.uid() 추가 (클라이언트가 넣어야 함)

ALTER TABLE public.system_folders
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "system_folders_insert_custom_timestamp_key" ON public.system_folders;

CREATE POLICY "system_folders_insert_custom_timestamp_key"
ON public.system_folders
FOR INSERT
TO authenticated
WITH CHECK (
  key ~ '^custom_[0-9]+$'
  AND COALESCE(is_active, true) = true
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "system_folders_update_own_custom" ON public.system_folders;

CREATE POLICY "system_folders_update_own_custom"
ON public.system_folders
FOR UPDATE
TO authenticated
USING (
  key ~ '^custom_[0-9]+$'
  AND created_by = auth.uid()
)
WITH CHECK (
  key ~ '^custom_[0-9]+$'
  AND created_by = auth.uid()
  AND COALESCE(is_active, true) = true
);

COMMENT ON COLUMN public.system_folders.created_by IS
  'custom_<timestamp> 폴더 생성자 — 본인만 이름·색·아이콘 수정 가능';
