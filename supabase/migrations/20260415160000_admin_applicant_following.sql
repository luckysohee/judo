-- admin_applicant_activity v5: following_curators (프로필 팔로우 탭과 동일 데이터)

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
  uc_json jsonb;
  follow_json jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'recommends', '[]'::jsonb,
      'saved_by_folder', '[]'::jsonb,
      'saved_unassigned', '[]'::jsonb,
      'usercard_saved_rows', '[]'::jsonb,
      'following_curators', '[]'::jsonb
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'recommends', '[]'::jsonb,
      'saved_by_folder', '[]'::jsonb,
      'saved_unassigned', '[]'::jsonb,
      'usercard_saved_rows', '[]'::jsonb,
      'following_curators', '[]'::jsonb
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

  SELECT COALESCE(
    (
      SELECT jsonb_agg(sub.row_obj ORDER BY sub.ord DESC)
      FROM (
        SELECT
          usp.created_at AS ord,
          jsonb_build_object(
            'id', usp.id,
            'user_id', usp.user_id,
            'place_id', usp.place_id,
            'created_at', usp.created_at,
            'places', jsonb_build_object(
              'name', pl.name,
              'address', COALESCE(pl.address, '')
            ),
            'user_saved_place_folders', COALESCE(uf.folders_json, '[]'::jsonb)
          ) AS row_obj
        FROM user_saved_places usp
        INNER JOIN places pl ON pl.id = usp.place_id
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            json_build_object(
              'folder_key', uspf.folder_key,
              'system_folders', json_build_object(
                'name', sf.name,
                'color', sf.color,
                'icon', sf.icon
              )
            )
            ORDER BY sf.sort_order NULLS LAST, sf.name
          ) AS folders_json
          FROM user_saved_place_folders uspf
          INNER JOIN system_folders sf ON sf.key = uspf.folder_key
          WHERE uspf.user_saved_place_id = usp.id
        ) uf ON true
        WHERE usp.user_id = p_target_user_id
      ) sub
    ),
    '[]'::jsonb
  )
  INTO uc_json;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN c.id IS NOT NULL THEN to_jsonb(c) || jsonb_build_object('curator_id', uf.curator_id)
          ELSE jsonb_build_object(
            'id', uf.curator_id,
            'curator_id', uf.curator_id,
            'username', 'unknown'
          )
        END
        ORDER BY uf.created_at DESC
      )
      FROM user_follows uf
      LEFT JOIN curators c ON c.id = uf.curator_id
      WHERE uf.user_id = p_target_user_id
    ),
    '[]'::jsonb
  )
  INTO follow_json;

  RETURN jsonb_build_object(
    'recommends', rec_json,
    'saved_by_folder', folders_json,
    'saved_unassigned', unassigned_json,
    'usercard_saved_rows', uc_json,
    'following_curators', follow_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_applicant_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_applicant_activity(uuid) IS
  'admin: 추천·폴더 요약 + UserCard 주입 + 팔로우 큐레이터 목록';
