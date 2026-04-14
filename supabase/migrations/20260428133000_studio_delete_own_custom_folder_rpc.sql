-- 스튜디오 커스텀 폴더 삭제: RLS/다단계 클라이언트 DELETE 가 0건만 지우거나 막히는 경우 대비
-- SECURITY DEFINER 이나 auth.uid() 로만 본인 행을 건드림.

CREATE OR REPLACE FUNCTION public.studio_delete_own_custom_folder(p_folder_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  place_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  IF p_folder_key IS NULL OR p_folder_key !~ '^custom_[0-9]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid folder key');
  END IF;

  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT usp.place_id)
      FROM public.user_saved_place_folders uspf
      INNER JOIN public.user_saved_places usp ON usp.id = uspf.user_saved_place_id
      WHERE uspf.folder_key = p_folder_key
        AND usp.user_id = uid
        AND usp.place_id IS NOT NULL
    ),
    ARRAY[]::uuid[]
  )
  INTO place_ids;

  DELETE FROM public.user_saved_places usp
  USING public.user_saved_place_folders uspf
  WHERE usp.id = uspf.user_saved_place_id
    AND uspf.folder_key = p_folder_key
    AND usp.user_id = uid;

  IF cardinality(place_ids) > 0 THEN
    DELETE FROM public.curator_places cp
    WHERE cp.curator_id = uid
      AND cp.place_id = ANY (place_ids);
  END IF;

  DELETE FROM public.system_folders sf
  WHERE sf.key = p_folder_key
    AND sf.key ~ '^custom_[0-9]+$'
    AND (sf.created_by = uid OR sf.created_by IS NULL)
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

COMMENT ON FUNCTION public.studio_delete_own_custom_folder(text) IS
  '본인 custom_* 폴더: 해당 폴더 링크된 user_saved_places 삭제(CASCADE로 uspf 정리), 관련 curator_places 삭제, 남은 링크 없으면 system_folders 삭제';
