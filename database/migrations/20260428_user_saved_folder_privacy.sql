-- Supabase 동일: supabase/migrations/20260428120000_user_saved_folder_privacy.sql

CREATE TABLE IF NOT EXISTS public.user_saved_folder_privacy (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  folder_key TEXT NOT NULL REFERENCES public.system_folders (key) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, folder_key)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_folder_privacy_user
  ON public.user_saved_folder_privacy (user_id);

ALTER TABLE public.user_saved_folder_privacy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_saved_folder_privacy_select_own" ON public.user_saved_folder_privacy;
CREATE POLICY "user_saved_folder_privacy_select_own"
  ON public.user_saved_folder_privacy FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_folder_privacy_insert_own" ON public.user_saved_folder_privacy;
CREATE POLICY "user_saved_folder_privacy_insert_own"
  ON public.user_saved_folder_privacy FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_folder_privacy_update_own" ON public.user_saved_folder_privacy;
CREATE POLICY "user_saved_folder_privacy_update_own"
  ON public.user_saved_folder_privacy FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_saved_folder_privacy_delete_own" ON public.user_saved_folder_privacy;
CREATE POLICY "user_saved_folder_privacy_delete_own"
  ON public.user_saved_folder_privacy FOR DELETE TO authenticated
  USING (user_id = auth.uid());
