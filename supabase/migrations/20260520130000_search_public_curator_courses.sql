-- 홈 「지금 뜨는 코스」 검색 — 공개 코스 전체에서 제목·지역·태그·큐레이터명 (48 풀과 무관)

CREATE OR REPLACE FUNCTION public.search_public_curator_courses(
  p_query text,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_q text;
  v_lim integer;
  v_off integer;
  v_pattern text;
  v_rows jsonb;
  v_has_more boolean;
  v_matched_count integer;
BEGIN
  v_q := btrim(coalesce(p_query, ''));
  IF char_length(v_q) < 1 THEN
    RETURN jsonb_build_object('courses', '[]'::jsonb, 'has_more', false);
  END IF;
  IF char_length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  v_lim := greatest(1, least(coalesce(p_limit, 24), 50));
  v_off := greatest(0, coalesce(p_offset, 0));
  v_pattern := '%' || replace(replace(v_q, '%', ''), '_', '') || '%';

  WITH matched AS (
    SELECT
      cc.id,
      cc.curator_id,
      cc.title,
      cc.description,
      cc.cover_image_url,
      cc.area,
      cc.theme_tags,
      cc.status,
      cc.is_public,
      cc.created_at,
      cc.updated_at,
      (
        SELECT count(*)::integer
        FROM public.curator_course_places ccp
        WHERE ccp.course_id = cc.id
      ) AS place_count
    FROM public.curator_courses cc
    LEFT JOIN public.profiles p ON p.id = cc.curator_id
    WHERE cc.status = 'published'
      AND cc.is_public = true
      AND cc.imported_from_course_id IS NULL
      AND (
        cc.title ILIKE v_pattern
        OR coalesce(cc.area, '') ILIKE v_pattern
        OR coalesce(cc.description, '') ILIKE v_pattern
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(cc.theme_tags, '{}'::text[])) AS t(tag)
          WHERE t.tag ILIKE v_pattern
        )
        OR coalesce(p.display_name, '') ILIKE v_pattern
        OR coalesce(p.username, '') ILIKE v_pattern
      )
    ORDER BY cc.updated_at DESC NULLS LAST, cc.created_at DESC
    LIMIT v_lim + 1
    OFFSET v_off
  ),
  counted AS (
    SELECT count(*)::integer AS c FROM matched
  ),
  page AS (
    SELECT * FROM matched LIMIT v_lim
  )
  SELECT
    (SELECT c FROM counted),
    coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p), '[]'::jsonb)
  INTO v_matched_count, v_rows;

  v_has_more := coalesce(v_matched_count, 0) > v_lim;

  RETURN jsonb_build_object(
    'courses', coalesce(v_rows, '[]'::jsonb),
    'has_more', v_has_more
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.search_public_curator_courses(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_curator_courses(text, integer, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.search_public_curator_courses(text, integer, integer) IS
  '홈 코스 discovery 검색 — 공개 원본 코스만. limit+1로 has_more 판단.';

NOTIFY pgrst, 'reload schema';
