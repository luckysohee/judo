-- 스튜디오 팔로워 목록: curators RLS 우회 없이, 본인 큐레이터(id)의 팔로워만 조회
-- 클라이언트에서 curators IN (…) 가 빈 배열이면 별명만 나오는 문제 해결

CREATE OR REPLACE FUNCTION public.studio_follower_previews(p_curator_id uuid)
RETURNS TABLE (
  user_id uuid,
  created_at timestamptz,
  display_nick text,
  handle_raw text,
  avatar_url text,
  is_curator boolean,
  curator_grade text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    uf.user_id,
    uf.created_at,
    NULLIF(
      TRIM(
        COALESCE(
          NULLIF(TRIM(COALESCE(c.display_name, '')), ''),
          NULLIF(TRIM(COALESCE(c.name, '')), ''),
          NULLIF(TRIM(COALESCE(p.display_name, '')), '')
        )
      ),
      ''
    ) AS display_nick,
    NULLIF(
      LOWER(
        REGEXP_REPLACE(
          TRIM(COALESCE(c.username, p.username, '')),
          '^@+',
          ''
        )
      ),
      ''
    ) AS handle_raw,
    NULLIF(
      TRIM(COALESCE(c.avatar_url, p.avatar_url, '')),
      ''
    ) AS avatar_url,
    (c.user_id IS NOT NULL) AS is_curator,
    c.grade::text AS curator_grade
  FROM public.user_follows uf
  LEFT JOIN public.profiles p ON p.id = uf.user_id
  LEFT JOIN public.curators c ON c.user_id = uf.user_id
  -- curator_id / curators.id 가 text·uuid 혼재해도 문자열로 맞춰 비교 (42883 방지)
  WHERE btrim(uf.curator_id::text) = btrim(p_curator_id::text)
    AND EXISTS (
      SELECT 1
      FROM public.curators me
      WHERE btrim(me.id::text) = btrim(p_curator_id::text)
        AND me.user_id = auth.uid()
    )
  ORDER BY uf.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.studio_follower_previews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_follower_previews(uuid) TO authenticated;

COMMENT ON FUNCTION public.studio_follower_previews(uuid) IS
  '스튜디오 팔로워 탭: 본인 curator id 기준 팔로워의 닉·핸들·큐레이터 여부 (RLS 무관)';

NOTIFY pgrst, 'reload schema';
