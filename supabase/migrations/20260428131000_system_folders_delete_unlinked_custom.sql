-- 이전 정책(created_by = auth.uid()만)은 앱이 본인 링크를 먼저 지운 뒤에도
-- 레거시 created_by NULL 행 삭제가 RLS에 막혔음.
-- custom_* 이고 어떤 user_saved_place_folders 도 참조하지 않을 때만 삭제 허용.

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
