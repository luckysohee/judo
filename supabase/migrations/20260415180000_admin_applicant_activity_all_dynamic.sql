-- v7: 모든 데이터 조회를 EXECUTE 로 — 테이블 누락 시에도 CREATE 성공, 404 방지

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

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'curator_places'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'places'
  ) THEN
    EXECUTE $rec$
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
            WHERE cp.curator_id = $1
            ORDER BY cp.created_at DESC
            LIMIT 100
          ) x
        ),
        '[]'::jsonb
      )
    $rec$
    INTO rec_json
    USING p_target_user_id;
  ELSE
    rec_json := '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_folders'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_place_folders'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_places'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'places'
  ) THEN
    EXECUTE $fold$
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
              AND usp.user_id = $1
            INNER JOIN places pl ON pl.id = usp.place_id
            WHERE uspf.folder_key = sf.key
          ) fp ON true
          WHERE COALESCE(sf.is_active, true)
        ),
        '[]'::jsonb
      )
    $fold$
    INTO folders_json
    USING p_target_user_id;
  ELSE
    folders_json := '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_places'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'places'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_place_folders'
  ) THEN
    EXECUTE $un$
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
            WHERE usp.user_id = $1
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
    $un$
    INTO unassigned_json
    USING p_target_user_id;
  ELSE
    unassigned_json := '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_places'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'places'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_saved_place_folders'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_folders'
  ) THEN
    EXECUTE $uc$
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
            WHERE usp.user_id = $1
          ) sub
        ),
        '[]'::jsonb
      )
    $uc$
    INTO uc_json
    USING p_target_user_id;
  ELSE
    uc_json := '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_follows'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'curators'
  ) THEN
    EXECUTE $follow$
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
          WHERE uf.user_id = $1
        ),
        '[]'::jsonb
      )
    $follow$
    INTO follow_json
    USING p_target_user_id;
  ELSE
    follow_json := '[]'::jsonb;
  END IF;

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
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO service_role;

COMMENT ON FUNCTION public.admin_applicant_activity(uuid) IS
  'admin: 추천·폴더 요약 + UserCard 주입 + 팔로우 (테이블 없으면 해당 키만 [])';

NOTIFY pgrst, 'reload schema';
