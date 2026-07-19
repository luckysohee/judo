-- 홈 맛집첩 검색 — 제목·지역·태그·설명·큐레이터·장소명 (느슨한 ilike)

CREATE OR REPLACE FUNCTION public.search_public_curator_lists(
  p_query text,
  p_limit integer DEFAULT 36,
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
  v_q2 text;
  v_lim integer;
  v_off integer;
  v_pattern text;
  v_pattern2 text;
  v_rows jsonb;
  v_matched_count integer;
  v_has_more boolean;
BEGIN
  v_q := btrim(coalesce(p_query, ''));
  IF left(v_q, 1) = '@' THEN
    v_q := btrim(substr(v_q, 2));
  END IF;
  IF char_length(v_q) < 1 THEN
    RETURN jsonb_build_object('lists', '[]'::jsonb, 'has_more', false);
  END IF;
  IF char_length(v_q) > 80 THEN
    v_q := left(v_q, 80);
  END IF;

  -- 성수동 → 성수 등 행정 접미 제거 (느슨한 매칭)
  v_q2 := regexp_replace(
    v_q,
    '(특별자치시|특별자치도|광역시|특별시|시|군|구|동|읍|면|리|로|길|가|역)$',
    '',
    'g'
  );
  v_q2 := btrim(v_q2);
  IF v_q2 = v_q OR char_length(v_q2) < 1 THEN
    v_q2 := NULL;
  END IF;

  v_lim := greatest(1, least(coalesce(p_limit, 36), 60));
  v_off := greatest(0, coalesce(p_offset, 0));
  v_pattern := '%' || replace(replace(v_q, '%', ''), '_', '') || '%';
  v_pattern2 := CASE
    WHEN v_q2 IS NULL THEN NULL
    ELSE '%' || replace(replace(v_q2, '%', ''), '_', '') || '%'
  END;

  WITH matched AS (
    SELECT
      cl.id,
      cl.curator_id,
      cl.title,
      cl.description,
      cl.cover_image_url,
      cl.area,
      cl.theme_tags,
      cl.status,
      cl.is_public,
      cl.created_at,
      cl.updated_at,
      (
        SELECT count(*)::integer
        FROM public.curator_list_places clp
        WHERE clp.list_id = cl.id
      ) AS place_count
    FROM public.curator_lists cl
    LEFT JOIN public.profiles p ON p.id = cl.curator_id
    LEFT JOIN public.curators cu ON cu.user_id = cl.curator_id
    WHERE cl.status = 'published'
      AND cl.is_public = true
      AND (
        cl.title ILIKE v_pattern
        OR coalesce(cl.area, '') ILIKE v_pattern
        OR coalesce(cl.description, '') ILIKE v_pattern
        OR (
          v_pattern2 IS NOT NULL
          AND (
            cl.title ILIKE v_pattern2
            OR coalesce(cl.area, '') ILIKE v_pattern2
            OR coalesce(cl.description, '') ILIKE v_pattern2
          )
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(cl.theme_tags, '{}'::text[])) AS t(tag)
          WHERE t.tag ILIKE v_pattern
            OR (v_pattern2 IS NOT NULL AND t.tag ILIKE v_pattern2)
        )
        OR coalesce(p.display_name, '') ILIKE v_pattern
        OR coalesce(p.username, '') ILIKE v_pattern
        OR coalesce(cu.name, '') ILIKE v_pattern
        OR coalesce(cu.display_name, '') ILIKE v_pattern
        OR coalesce(cu.username, '') ILIKE v_pattern
        OR coalesce(cu.slug, '') ILIKE v_pattern
        OR (
          v_pattern2 IS NOT NULL
          AND (
            coalesce(p.display_name, '') ILIKE v_pattern2
            OR coalesce(p.username, '') ILIKE v_pattern2
            OR coalesce(cu.name, '') ILIKE v_pattern2
            OR coalesce(cu.display_name, '') ILIKE v_pattern2
            OR coalesce(cu.username, '') ILIKE v_pattern2
            OR coalesce(cu.slug, '') ILIKE v_pattern2
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.curator_list_places clp
          JOIN public.places pl ON pl.id = clp.place_id
          WHERE clp.list_id = cl.id
            AND (
              coalesce(pl.name, '') ILIKE v_pattern
              OR coalesce(pl.place_name, '') ILIKE v_pattern
              OR coalesce(pl.address, '') ILIKE v_pattern
              OR (
                v_pattern2 IS NOT NULL
                AND (
                  coalesce(pl.name, '') ILIKE v_pattern2
                  OR coalesce(pl.place_name, '') ILIKE v_pattern2
                  OR coalesce(pl.address, '') ILIKE v_pattern2
                )
              )
            )
        )
      )
    ORDER BY cl.updated_at DESC NULLS LAST, cl.created_at DESC
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
    'lists', coalesce(v_rows, '[]'::jsonb),
    'has_more', v_has_more
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.search_public_curator_lists(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_curator_lists(text, integer, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.search_public_curator_lists(text, integer, integer) IS
  '홈 맛집첩 discovery 검색 — 제목·지역·태그·큐레이터·장소명. 행정 접미 제거 패턴 포함.';

NOTIFY pgrst, 'reload schema';
