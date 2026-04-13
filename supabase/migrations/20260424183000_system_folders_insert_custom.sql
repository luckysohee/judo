-- SaveModal / 스튜디오「새 폴더」: custom_<timestamp> 키만 로그인 사용자가 system_folders에 추가 가능
-- (기존 시드 폴더는 앱·마이그레이션에서만 관리)

DROP POLICY IF EXISTS "system_folders_insert_custom_timestamp_key" ON public.system_folders;

CREATE POLICY "system_folders_insert_custom_timestamp_key"
ON public.system_folders
FOR INSERT
TO authenticated
WITH CHECK (
  key ~ '^custom_[0-9]+$'
  AND COALESCE(is_active, true) = true
);

COMMENT ON POLICY "system_folders_insert_custom_timestamp_key" ON public.system_folders IS
  '클라이언트가 custom_<Date.now()> 형태로 개인 폴더 행 추가 (스튜디오·저장 모달)';
