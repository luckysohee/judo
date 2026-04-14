-- Supabase 동일: supabase/migrations/20260428132000_curator_places_delete_own_policy.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'curator_places'
      AND c.relrowsecurity
  ) THEN
    EXECUTE $pol$
      DROP POLICY IF EXISTS "curator_places_delete_own" ON public.curator_places;
      CREATE POLICY "curator_places_delete_own"
      ON public.curator_places
      FOR DELETE
      TO authenticated
      USING (auth.uid() = curator_id);
    $pol$;
  END IF;
END $$;
