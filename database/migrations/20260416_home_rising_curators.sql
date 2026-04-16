-- mirror: supabase/migrations/20260416170000_home_rising_curators.sql
-- 홈 상단 스트립: 최근 7일 잔·팔로 기준 "떠오르는 큐레이터"
-- curator_places.curator_id 가 curators.id 또는 auth.uid() 인 레거시 모두 curators 행으로 귀속

CREATE OR REPLACE FUNCTION public.home_rising_curators(p_limit integer DEFAULT 8)
RETURNS TABLE (
  curator_id uuid,
  username text,
  display_name text,
  avatar_url text,
  week_places bigint,
  week_follows bigint,
  score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lim AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20)::int AS n
  ),
  week_start AS (
    SELECT ((now() AT TIME ZONE 'utc') - interval '7 days') AS t
  ),
  cur AS (
    SELECT
      c.id,
      c.user_id,
      btrim(c.username) AS username_raw,
      COALESCE(NULLIF(btrim(c.display_name), ''), NULLIF(btrim(c.name), ''), btrim(c.username)) AS disp,
      NULLIF(btrim(COALESCE(c.avatar_url, c.image, '')), '') AS av
    FROM curators c
    WHERE c.username IS NOT NULL
      AND btrim(c.username) <> ''
      AND COALESCE(c.status::text, 'active') NOT IN ('suspended', 'inactive')
  ),
  cp_raw AS (
    SELECT cp.curator_id AS raw_id, COUNT(*)::bigint AS cnt
    FROM curator_places cp
    CROSS JOIN week_start w
    WHERE cp.created_at >= w.t
      AND (cp.is_archived IS NOT TRUE)
    GROUP BY cp.curator_id
  ),
  cp_norm AS (
    SELECT c.id AS curator_pk, SUM(r.cnt)::bigint AS week_places
    FROM cp_raw r
    INNER JOIN cur c ON (c.id = r.raw_id OR c.user_id = r.raw_id)
    GROUP BY c.id
  ),
  fol_norm AS (
    SELECT
      uf.curator_id::uuid AS curator_pk,
      COUNT(*)::bigint AS week_follows
    FROM user_follows uf
    CROSS JOIN week_start w
    WHERE uf.created_at >= w.t
      AND uf.curator_id IS NOT NULL
      AND btrim(uf.curator_id::text) <> ''
    GROUP BY uf.curator_id::uuid
  ),
  scored AS (
    SELECT
      c.id AS curator_id,
      c.username_raw::text AS username,
      c.disp::text AS display_name,
      c.av::text AS avatar_url,
      COALESCE(p.week_places, 0::bigint) AS week_places,
      COALESCE(f.week_follows, 0::bigint) AS week_follows,
      (COALESCE(p.week_places, 0::bigint) * 2 + COALESCE(f.week_follows, 0::bigint))::numeric AS score
    FROM cur c
    LEFT JOIN cp_norm p ON p.curator_pk = c.id
    LEFT JOIN fol_norm f ON f.curator_pk = c.id
    WHERE COALESCE(p.week_places, 0) + COALESCE(f.week_follows, 0) > 0
  )
  SELECT
    s.curator_id,
    s.username,
    s.display_name,
    s.avatar_url,
    s.week_places,
    s.week_follows,
    s.score
  FROM scored s
  CROSS JOIN lim
  ORDER BY s.score DESC, s.week_places DESC, s.week_follows DESC, s.display_name ASC
  LIMIT (SELECT n FROM lim);
$$;

REVOKE ALL ON FUNCTION public.home_rising_curators(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.home_rising_curators(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.home_rising_curators(integer) TO authenticated;

COMMENT ON FUNCTION public.home_rising_curators(integer) IS
  '홈: 최근 7일 공개 잔 수×2 + 팔로 수로 떠오르는 큐레이터';
