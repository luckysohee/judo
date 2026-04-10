-- 관리자: 큐레이터 신청자의 앱 내 추천·저장을 **JSON 배열**로 조회 (초기 단순 버전)
-- 각 원소: { kind, place_name, address, at } — kind 는 recommend | saved

CREATE OR REPLACE FUNCTION public.admin_applicant_activity(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'admin'
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

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
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_applicant_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_applicant_activity(uuid) TO service_role;

COMMENT ON FUNCTION public.admin_applicant_activity(uuid) IS
  'admin만: 신청자 기준 추천(curator_places)·저장(user_saved_places) 목록 JSON 배열';

NOTIFY pgrst, 'reload schema';
