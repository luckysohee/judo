-- Supabase 동일: supabase/migrations/20260426120000_system_folders_created_by_update.sql

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
