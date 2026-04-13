-- Supabase 동일: supabase/migrations/20260424183000_system_folders_insert_custom.sql

DROP POLICY IF EXISTS "system_folders_insert_custom_timestamp_key" ON public.system_folders;

CREATE POLICY "system_folders_insert_custom_timestamp_key"
ON public.system_folders
FOR INSERT
TO authenticated
WITH CHECK (
  key ~ '^custom_[0-9]+$'
  AND COALESCE(is_active, true) = true
);
