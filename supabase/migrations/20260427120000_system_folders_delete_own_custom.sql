-- 본인이 만든 custom_<timestamp> 폴더 행 삭제 (클라이언트가 먼저 본인 user_saved_place_folders 정리)

DROP POLICY IF EXISTS "system_folders_delete_own_custom" ON public.system_folders;

CREATE POLICY "system_folders_delete_own_custom"
ON public.system_folders
FOR DELETE
TO authenticated
USING (
  key ~ '^custom_[0-9]+$'
  AND created_by = auth.uid()
);

COMMENT ON POLICY "system_folders_delete_own_custom" ON public.system_folders IS
  '본인 생성 커스텀 폴더만 삭제 — FK 전 연결 행은 앱에서 user_saved_place_folders 제거';
