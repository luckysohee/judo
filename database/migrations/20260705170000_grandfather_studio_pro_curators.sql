-- supabase/migrations/20260705170000_grandfather_studio_pro_curators.sql 와 동일

DO $$
DECLARE
  v_pro_until timestamptz := timestamptz '2027-12-31 23:59:59+09';
  v_updated integer;
BEGIN
  UPDATE public.curators
  SET studio_pro_until = v_pro_until
  WHERE studio_pro_until IS NULL
     OR studio_pro_until < now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'grandfather_studio_pro: updated % curator(s)', v_updated;
END $$;
