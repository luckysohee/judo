-- Supabase 동일: supabase/migrations/20260427120000_system_folders_delete_own_custom.sql

DROP POLICY IF EXISTS "system_folders_delete_own_custom" ON public.system_folders;

CREATE POLICY "system_folders_delete_own_custom"
ON public.system_folders
FOR DELETE
TO authenticated
USING (
  key ~ '^custom_[0-9]+$'
  AND created_by = auth.uid()
);
