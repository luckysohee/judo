-- custom_<digits> 폴더는 생성자(created_by)만 SELECT. 시스템 시드 폴더는 그대로 공개.

DROP POLICY IF EXISTS "Everyone can view system folders" ON public.system_folders;
DROP POLICY IF EXISTS "System folders are viewable by everyone" ON public.system_folders;
DROP POLICY IF EXISTS "system_folders_select_public_or_own_custom" ON public.system_folders;

CREATE POLICY "system_folders_select_public_or_own_custom"
ON public.system_folders
FOR SELECT
TO public
USING (
  (key !~ '^custom_[0-9]+$')
  OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
);

COMMENT ON POLICY "system_folders_select_public_or_own_custom" ON public.system_folders IS
  '시스템 폴더(비 custom_*)는 누구나 읽기; custom_* 는 본인(created_by = auth.uid())만';
