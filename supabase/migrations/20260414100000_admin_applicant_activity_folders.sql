-- admin_applicant_activity v2: 반환 형식 { items, summary }, 폴더명·폴더별 저장 수
-- (이미 20260413120000 을 적용한 DB는 이 마이그레이션으로 함수만 교체)

CREATE OR REPLACE FUNCTION public.admin_applicant_activity(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  items jsonb;
  summary jsonb;
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
    SELECT 1 FROM profiles pr
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

  SELECT COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT kind, place_name, address, at, folder_names, folder_count
        FROM (
          SELECT
            'recommend'::text AS kind,
            pl.name AS place_name,
            COALESCE(pl.address, '')::text AS address,
            cp.created_at AS at,
            NULL::text AS folder_names,
            0::int AS folder_count
          FROM curator_places cp
          INNER JOIN places pl ON pl.id = cp.place_id
          WHERE cp.curator_id = p_target_user_id
          UNION ALL
          SELECT
            'saved'::text,
            pl.name,
            COALESCE(pl.address, '')::text,
            usp.created_at,
            (
              SELECT string_agg(sf.name, ', ' ORDER BY sf.sort_order NULLS LAST, sf.name)
              FROM user_saved_place_folders uspf2
              INNER JOIN system_folders sf ON sf.key = uspf2.folder_key
              WHERE uspf2.user_saved_place_id = usp.id
            ),
            COALESCE(
              (
                SELECT COUNT(*)::int
                FROM user_saved_place_folders uspf3
                WHERE uspf3.user_saved_place_id = usp.id
              ),
              0
            )
          FROM user_saved_places usp
          INNER JOIN places pl ON pl.id = usp.place_id
          WHERE usp.user_id = p_target_user_id
        ) u
        ORDER BY u.at DESC
        LIMIT 100
      ) t
    ),
    '[]'::jsonb
  )
  INTO items;

  SELECT jsonb_build_object(
    'recommend_count',
    (SELECT COUNT(*)::int FROM curator_places WHERE curator_id = p_target_user_id),
    'saved_count',
    (SELECT COUNT(*)::int FROM user_saved_places WHERE user_id = p_target_user_id),
    'folders',
    COALESCE(
      (
        SELECT jsonb_agg(
          json_build_object('name', fb.folder_name, 'count', fb.cnt)
          ORDER BY fb.sort_order NULLS LAST, fb.folder_name
        )
        FROM (
          SELECT
            sf.name AS folder_name,
            sf.sort_order,
            COUNT(*)::int AS cnt
          FROM user_saved_places usp
          INNER JOIN user_saved_place_folders uspf ON uspf.user_saved_place_id = usp.id
          INNER JOIN system_folders sf ON sf.key = uspf.folder_key
          WHERE usp.user_id = p_target_user_id
          GROUP BY sf.key, sf.name, sf.sort_order
        ) fb
      ),
      '[]'::jsonb
    )
  )
  INTO summary;

  RETURN jsonb_build_object('items', items, 'summary', summary);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_applicant_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_applicant_activity(uuid) IS
  'admin: 신청자 추천·저장 목록 + 행별 폴더명/폴더 수, 요약(추천·저장 건수·폴더별 저장 수)';
