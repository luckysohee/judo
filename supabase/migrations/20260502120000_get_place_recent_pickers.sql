-- 장소 상세·픽 UI: 최근 픽한 유저 3~5명 (아바타 스택용). 공개 조회.

CREATE OR REPLACE FUNCTION public.get_place_recent_pickers(p_place_id uuid)
RETURNS TABLE (
  user_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
  SELECT pp.user_id, pp.created_at
  FROM public.place_picks pp
  WHERE pp.place_id = p_place_id
  ORDER BY pp.created_at DESC
  LIMIT 5;
$func$;

COMMENT ON FUNCTION public.get_place_recent_pickers(uuid) IS
  '해당 장소를 최근에 픽한 유저 최대 5명(user_id, 픽 시각). RLS는 place_picks 공개 SELECT 와 동일.';

REVOKE ALL ON FUNCTION public.get_place_recent_pickers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_place_recent_pickers(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
