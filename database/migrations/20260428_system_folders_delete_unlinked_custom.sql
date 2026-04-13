-- Supabase 동일: supabase/migrations/20260428131000_system_folders_delete_unlinked_custom.sql

DROP POLICY IF EXISTS "system_folders_delete_own_custom" ON public.system_folders;

CREATE POLICY "system_folders_delete_own_custom"
ON public.system_folders
FOR DELETE
TO authenticated
USING (
  key ~ '^custom_[0-9]+$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_saved_place_folders uspf
    WHERE uspf.folder_key = system_folders.key
  )
  AND (
    created_by = auth.uid()
    OR created_by IS NULL
  )
);

COMMENT ON POLICY "system_folders_delete_own_custom" ON public.system_folders IS
  'custom_*: 모든 링크 제거 후 본인 생성 또는 레거시(created_by NULL) 행 삭제';
