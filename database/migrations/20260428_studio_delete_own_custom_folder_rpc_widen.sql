-- Supabase 동일: supabase/migrations/20260428134000_studio_delete_own_custom_folder_rpc_widen.sql

CREATE OR REPLACE FUNCTION public.studio_delete_own_custom_folder(p_folder_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  curator_pk uuid;
  place_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  IF p_folder_key IS NULL OR p_folder_key !~ '^custom_[0-9]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid folder key');
  END IF;

  SELECT c.id
  INTO curator_pk
  FROM public.curators c
  WHERE c.user_id = uid
  LIMIT 1;

  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT usp.place_id)
      FROM public.user_saved_place_folders uspf
      INNER JOIN public.user_saved_places usp ON usp.id = uspf.user_saved_place_id
      WHERE uspf.folder_key = p_folder_key
        AND usp.place_id IS NOT NULL
        AND (
          usp.user_id = uid
          OR (curator_pk IS NOT NULL AND usp.user_id = curator_pk)
        )
    ),
    ARRAY[]::uuid[]
  )
  INTO place_ids;

  DELETE FROM public.user_saved_places usp
  USING public.user_saved_place_folders uspf
  WHERE usp.id = uspf.user_saved_place_id
    AND uspf.folder_key = p_folder_key
    AND (
      usp.user_id = uid
      OR (curator_pk IS NOT NULL AND usp.user_id = curator_pk)
    );

  IF cardinality(place_ids) > 0 THEN
    DELETE FROM public.curator_places cp
    WHERE cp.place_id = ANY (place_ids)
      AND (
        cp.curator_id = uid
        OR (curator_pk IS NOT NULL AND cp.curator_id = curator_pk)
      );
  END IF;

  DELETE FROM public.system_folders sf
  WHERE sf.key = p_folder_key
    AND sf.key ~ '^custom_[0-9]+$'
    AND (
      sf.created_by = uid
      OR sf.created_by IS NULL
      OR (curator_pk IS NOT NULL AND sf.created_by = curator_pk)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_saved_place_folders u2
      WHERE u2.folder_key = sf.key
    );

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_place_ids', to_jsonb(place_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.studio_delete_own_custom_folder(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_delete_own_custom_folder(text) TO authenticated;
