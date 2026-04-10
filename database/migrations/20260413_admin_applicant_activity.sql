-- 관리자: 큐레이터 신청자 추천·저장 타임라인 + 요약(추천/저장 건수, 폴더별 저장 개수)
-- 반환: { "items": [ { kind, place_name, address, at }, ... ], "summary": { recommend_count, saved_count, folders: [ { name, count }, ... ] } }

CREATE OR REPLACE FUNCTION public.admin_applicant_activity(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  items jsonb;
  rec_count bigint;
  sav_count bigint;
  folders jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'items', '[]'::jsonb,
      'summary', jsonb_build_object(
        'recommend_count', 0,
        'saved_count', 0,
        'folders', '[]'::jsonb
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'items', '[]'::jsonb,
      'summary', jsonb_build_object(
        'recommend_count', 0,
        'saved_count', 0,
        'folders', '[]'::jsonb
      )
    );
  END IF;

  SELECT COUNT(*) INTO rec_count
  FROM curator_places cp
  WHERE cp.curator_id = p_target_user_id;

  SELECT COUNT(*) INTO sav_count
  FROM user_saved_places usp
  WHERE usp.user_id = p_target_user_id;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT kind, place_name, address, at
        FROM (
          SELECT
            'recommend'::text AS kind,
            pl.name AS place_name,
            COALESCE(pl.address, '')::text AS address,
            cp.created_at AS at
          FROM curator_places cp
          INNER JOIN places pl ON pl.id = cp.place_id
          WHERE cp.curator_id = p_target_user_id
          UNION ALL
          SELECT
            'saved'::text,
            pl.name,
            COALESCE(pl.address, '')::text,
            usp.created_at
          FROM user_saved_places usp
          INNER JOIN places pl ON pl.id = usp.place_id
          WHERE usp.user_id = p_target_user_id
        ) u
        ORDER BY at DESC
        LIMIT 100
      ) t
    ),
    '[]'::jsonb
  )
  INTO items;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(x.obj ORDER BY x.ord)
      FROM (
        SELECT sf.sort_order AS ord,
          jsonb_build_object('name', sf.name, 'count', c.cnt) AS obj
        FROM (
          SELECT uspf.folder_key, COUNT(DISTINCT uspf.user_saved_place_id) AS cnt
          FROM user_saved_place_folders uspf
          INNER JOIN user_saved_places usp ON usp.id = uspf.user_saved_place_id
          WHERE usp.user_id = p_target_user_id
          GROUP BY uspf.folder_key
        ) c
        INNER JOIN system_folders sf ON sf.key = c.folder_key
        UNION ALL
        SELECT 999999 AS ord,
          jsonb_build_object('name', '폴더 미연결', 'count', z.cnt) AS obj
        FROM (
          SELECT COUNT(*)::bigint AS cnt
          FROM user_saved_places usp
          WHERE usp.user_id = p_target_user_id
            AND NOT EXISTS (
              SELECT 1 FROM user_saved_place_folders uspf
              WHERE uspf.user_saved_place_id = usp.id
            )
        ) z
        WHERE z.cnt > 0
      ) x
    ),
    '[]'::jsonb
  )
  INTO folders;

  RETURN jsonb_build_object(
    'items', items,
    'summary', jsonb_build_object(
      'recommend_count', rec_count,
      'saved_count', sav_count,
      'folders', folders
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_applicant_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO service_role;

COMMENT ON FUNCTION public.admin_applicant_activity(uuid) IS
  'admin만: 신청자 추천·저장 타임라인(items) + 건수·폴더별 저장 개수(summary)';

NOTIFY pgrst, 'reload schema';
