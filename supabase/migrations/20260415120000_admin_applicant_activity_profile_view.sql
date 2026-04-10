-- admin_applicant_activity v3: 프로필 저장 탭과 동일한 폴더별 구조
-- { recommends, saved_by_folder[{folder_key,name,color,icon,sort_order,places}], saved_unassigned }

CREATE OR REPLACE FUNCTION public.admin_applicant_activity(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  rec_json jsonb;
  folders_json jsonb;
  unassigned_json jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'recommends', '[]'::jsonb,
      'saved_by_folder', '[]'::jsonb,
      'saved_unassigned', '[]'::jsonb
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'recommends', '[]'::jsonb,
      'saved_by_folder', '[]'::jsonb,
      'saved_unassigned', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        json_build_object('place_name', x.place_name, 'address', x.address, 'at', x.at)
        ORDER BY x.at DESC
      )
      FROM (
        SELECT
          pl.name AS place_name,
          COALESCE(pl.address, '')::text AS address,
          cp.created_at AS at
        FROM curator_places cp
        INNER JOIN places pl ON pl.id = cp.place_id
        WHERE cp.curator_id = p_target_user_id
        ORDER BY cp.created_at DESC
        LIMIT 100
      ) x
    ),
    '[]'::jsonb
  )
  INTO rec_json;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'folder_key', sf.key,
          'name', sf.name,
          'color', sf.color,
          'icon', sf.icon,
          'sort_order', sf.sort_order,
          'places', COALESCE(fp.places_json, '[]'::jsonb)
        )
        ORDER BY sf.sort_order NULLS LAST, sf.name
      )
      FROM system_folders sf
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          json_build_object(
            'place_name', pl.name,
            'address', COALESCE(pl.address, ''),
            'at', usp.created_at
          )
          ORDER BY usp.created_at DESC
        ) AS places_json
        FROM user_saved_place_folders uspf
        INNER JOIN user_saved_places usp
          ON usp.id = uspf.user_saved_place_id
          AND usp.user_id = p_target_user_id
        INNER JOIN places pl ON pl.id = usp.place_id
        WHERE uspf.folder_key = sf.key
      ) fp ON true
      WHERE COALESCE(sf.is_active, true)
    ),
    '[]'::jsonb
  )
  INTO folders_json;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        json_build_object('place_name', x.place_name, 'address', x.address, 'at', x.at)
        ORDER BY x.at DESC
      )
      FROM (
        SELECT
          pl.name AS place_name,
          COALESCE(pl.address, '')::text AS address,
          usp.created_at AS at
        FROM user_saved_places usp
        INNER JOIN places pl ON pl.id = usp.place_id
        WHERE usp.user_id = p_target_user_id
          AND NOT EXISTS (
            SELECT 1
            FROM user_saved_place_folders uspf
            WHERE uspf.user_saved_place_id = usp.id
          )
        ORDER BY usp.created_at DESC
      ) x
    ),
    '[]'::jsonb
  )
  INTO unassigned_json;

  RETURN jsonb_build_object(
    'recommends', rec_json,
    'saved_by_folder', folders_json,
    'saved_unassigned', unassigned_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_applicant_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_applicant_activity(uuid) IS
  'admin: 추천 목록 + 프로필과 동일한 system_folders별 저장 장소 + 폴더 미연결 저장';
