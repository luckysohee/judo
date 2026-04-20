-- studio_archive_extended_insights: 스타일 집계 places 는 LEFT JOIN (고아 cp·조인 실패 시에도 curator 쪽 태그 반영)
CREATE OR REPLACE FUNCTION public.studio_archive_extended_insights(p_curator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
BEGIN
  IF auth.uid() IS NULL OR p_curator_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object(
      'one_line_top', '[]'::jsonb,
      'style', jsonb_build_object(
        'alcohol', '[]'::jsonb,
        'moods', '[]'::jsonb,
        'tags', '[]'::jsonb,
        'categories', '[]'::jsonb
      ),
      'followers', jsonb_build_object(
        'saves_on_picks', 0,
        'distinct_savers', 0,
        'regions', '[]'::jsonb,
        'checkins_total', 0
      )
    );
  END IF;

  RETURN (
    WITH params AS (
      SELECT
        p_curator_id AS uid,
        (SELECT c.id FROM curators c WHERE c.user_id = p_curator_id LIMIT 1) AS curator_row_id
    ),
    my_curator_ids AS (
      SELECT DISTINCT x AS cid
      FROM unnest(
        ARRAY[
          (SELECT uid FROM params),
          (SELECT curator_row_id FROM params)
        ]::uuid[]
      ) AS u(x)
      WHERE x IS NOT NULL
    ),
    my_place_ids AS (
      SELECT DISTINCT cp.place_id AS pid
      FROM curator_places cp
      WHERE btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
        AND (cp.is_archived IS NOT TRUE)
        AND cp.place_id IS NOT NULL
    ),
    one_line_rows AS (
      SELECT DISTINCT ON (cp.place_id)
        cp.place_id,
        NULLIF(trim(cp.one_line_reason), '') AS line
      FROM curator_places cp
      WHERE btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
        AND (cp.is_archived IS NOT TRUE)
        AND length(trim(coalesce(cp.one_line_reason, ''))) > 1
      ORDER BY cp.place_id, cp.created_at DESC NULLS LAST
    ),
    save_by_place AS (
      SELECT usp.place_id, COUNT(*)::bigint AS c
      FROM user_saved_places usp
      WHERE usp.place_id IN (SELECT pid FROM my_place_ids)
      GROUP BY usp.place_id
    ),
    one_line_top AS (
      SELECT COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'text', q.line,
              'saves', q.saves,
              'place_id', q.place_id,
              'place_name', q.place_name
            )
            ORDER BY q.saves DESC, char_length(q.line) ASC, q.place_name ASC
          )
          FROM (
            SELECT
              ol.place_id,
              ol.line,
              COALESCE(sb.c, 0)::bigint AS saves,
              COALESCE(NULLIF(trim(p.name), ''), '(이름 없음)')::text AS place_name
            FROM one_line_rows ol
            LEFT JOIN save_by_place sb ON sb.place_id = ol.place_id
            LEFT JOIN places p ON p.id = ol.place_id
            WHERE ol.line IS NOT NULL
            ORDER BY COALESCE(sb.c, 0) DESC, char_length(ol.line) ASC, COALESCE(NULLIF(trim(p.name), ''), '') ASC
            LIMIT 5
          ) q
        ),
        '[]'::jsonb
      ) AS j
    ),
    alc AS (
      SELECT s.label, COUNT(*)::bigint AS cnt
      FROM (
        SELECT DISTINCT
          cp.id AS cp_id,
          trim(u.x) AS label
        FROM curator_places cp
        LEFT JOIN places p ON p.id = cp.place_id
        CROSS JOIN LATERAL unnest(
          array_cat(
            public.cp_str_arr_for_unnest(cp.alcohol_types),
            CASE
              WHEN p.id IS NULL OR NULLIF(trim(COALESCE(p.alcohol_type, '')), '') IS NULL THEN
                ARRAY[]::text[]
              ELSE
                ARRAY[trim(COALESCE(p.alcohol_type, ''))]
            END
          )
        ) AS u(x)
        WHERE btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
          AND (cp.is_archived IS NOT TRUE)
          AND length(trim(u.x)) > 0
      ) s
      GROUP BY s.label
    ),
    alc_tot AS (SELECT COALESCE(SUM(cnt), 0)::bigint AS t FROM alc),
    alc_pct AS (
      SELECT COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'label', a.label,
              'pct', CASE
                WHEN (SELECT t FROM alc_tot) > 0
                THEN round(100 * a.cnt::numeric / (SELECT t FROM alc_tot))::int
                ELSE 0
              END
            )
            ORDER BY a.cnt DESC
          )
          FROM (SELECT * FROM alc ORDER BY cnt DESC LIMIT 8) a
        ),
        '[]'::jsonb
      ) AS j
    ),
    md AS (
      SELECT s.label, COUNT(*)::bigint AS cnt
      FROM (
        SELECT DISTINCT
          cp.id AS cp_id,
          trim(u.x) AS label
        FROM curator_places cp
        LEFT JOIN places p ON p.id = cp.place_id
        CROSS JOIN LATERAL unnest(
          array_cat(
            public.cp_str_arr_for_unnest(cp.moods),
            CASE
              WHEN p.id IS NULL OR NULLIF(trim(COALESCE(p.atmosphere, '')), '') IS NULL THEN
                ARRAY[]::text[]
              ELSE
                ARRAY[trim(COALESCE(p.atmosphere, ''))]
            END
          )
        ) AS u(x)
        WHERE btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
          AND (cp.is_archived IS NOT TRUE)
          AND length(trim(u.x)) > 0
      ) s
      GROUP BY s.label
    ),
    md_tot AS (SELECT COALESCE(SUM(cnt), 0)::bigint AS t FROM md),
    md_pct AS (
      SELECT COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'label', m.label,
              'pct', CASE
                WHEN (SELECT t FROM md_tot) > 0
                THEN round(100 * m.cnt::numeric / (SELECT t FROM md_tot))::int
                ELSE 0
              END
            )
            ORDER BY m.cnt DESC
          )
          FROM (SELECT * FROM md ORDER BY cnt DESC LIMIT 8) m
        ),
        '[]'::jsonb
      ) AS j
    ),
    tg AS (
      SELECT s.label, COUNT(*)::bigint AS cnt
      FROM (
        SELECT DISTINCT
          cp.id AS cp_id,
          trim(u.x) AS label
        FROM curator_places cp
        LEFT JOIN places p ON p.id = cp.place_id
        CROSS JOIN LATERAL unnest(
          array_cat(
            public.cp_str_arr_for_unnest(cp.tags),
            public.cp_str_arr_for_unnest(
              CASE
                WHEN p.id IS NULL THEN '[]'::jsonb
                WHEN p.tags IS NULL THEN '[]'::jsonb
                ELSE to_jsonb(p.tags)
              END
            )
          )
        ) AS u(x)
        WHERE btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
          AND (cp.is_archived IS NOT TRUE)
          AND length(trim(u.x)) > 0
      ) s
      GROUP BY s.label
    ),
    tg_tot AS (SELECT COALESCE(SUM(cnt), 0)::bigint AS t FROM tg),
    tg_pct AS (
      SELECT COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'label', tgrow.label,
              'pct', CASE
                WHEN (SELECT t FROM tg_tot) > 0
                THEN round(100 * tgrow.cnt::numeric / (SELECT t FROM tg_tot))::int
                ELSE 0
              END
            )
            ORDER BY tgrow.cnt DESC
          )
          FROM (SELECT * FROM tg ORDER BY cnt DESC LIMIT 10) tgrow
        ),
        '[]'::jsonb
      ) AS j
    ),
    cat AS (
      SELECT trim(p.category) AS label, COUNT(*)::bigint AS cnt
      FROM curator_places cp
      JOIN places p ON p.id = cp.place_id
      WHERE btrim(cp.curator_id::text) IN (SELECT btrim(cid::text) FROM my_curator_ids)
        AND (cp.is_archived IS NOT TRUE)
        AND p.category IS NOT NULL
        AND length(trim(p.category)) > 0
        AND trim(p.category) <> ALL (ARRAY['미분류', '기타']::text[])
      GROUP BY 1
    ),
    cat_tot AS (SELECT COALESCE(SUM(cnt), 0)::bigint AS t FROM cat),
    cat_pct AS (
      SELECT COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'label', c.label,
              'pct', CASE
                WHEN (SELECT t FROM cat_tot) > 0
                THEN round(100 * c.cnt::numeric / (SELECT t FROM cat_tot))::int
                ELSE 0
              END
            )
            ORDER BY c.cnt DESC
          )
          FROM (SELECT * FROM cat ORDER BY cnt DESC LIMIT 8) c
        ),
        '[]'::jsonb
      ) AS j
    ),
    follow_u AS (
      SELECT DISTINCT uf.user_id
      FROM user_follows uf, params p
      WHERE (
          p.curator_row_id IS NOT NULL
          AND btrim(uf.curator_id::text) = btrim(p.curator_row_id::text)
        )
        OR btrim(uf.curator_id::text) = btrim(p.uid::text)
    ),
    fol_saves AS (
      SELECT usp.user_id, usp.place_id
      FROM user_saved_places usp
      WHERE usp.place_id IN (SELECT pid FROM my_place_ids)
        AND usp.user_id IN (SELECT user_id FROM follow_u)
    ),
    fol_agg AS (
      SELECT
        (SELECT COUNT(*)::bigint FROM fol_saves) AS saves_on_picks,
        (SELECT COUNT(DISTINCT user_id)::bigint FROM fol_saves) AS distinct_savers
    ),
    reg AS (
      SELECT
        CASE
          WHEN p.address IS NULL OR btrim(p.address) = '' THEN
            COALESCE(NULLIF(btrim(p.name), ''), '기타')
          ELSE
            NULLIF(
              btrim(
                split_part(btrim(p.address), ' ', 1)
                || CASE
                  WHEN split_part(btrim(p.address), ' ', 2) <> ''
                  THEN ' ' || split_part(btrim(p.address), ' ', 2)
                  ELSE ''
                END
              ),
              ''
            )
        END AS region_label,
        COUNT(*)::bigint AS c
      FROM fol_saves fs
      JOIN places p ON p.id = fs.place_id
      GROUP BY 1
    ),
    reg_json AS (
      SELECT COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object('label', r.region_label, 'saves', r.c)
            ORDER BY r.c DESC
          )
          FROM (SELECT * FROM reg ORDER BY c DESC LIMIT 5) r
        ),
        '[]'::jsonb
      ) AS j
    ),
    checkin_cnt AS (
      SELECT COUNT(*)::bigint AS n
      FROM check_ins ci
      WHERE EXISTS (
          SELECT 1
          FROM places pl
          WHERE pl.id IN (SELECT pid FROM my_place_ids)
            AND (
              (
                pl.kakao_place_id IS NOT NULL
                AND btrim(pl.kakao_place_id) <> ''
                AND ci.place_id = pl.kakao_place_id
              )
              OR ci.place_id = pl.id::text
            )
        )
    )
    SELECT jsonb_build_object(
      'one_line_top', (SELECT j FROM one_line_top),
      'style', jsonb_build_object(
        'alcohol', (SELECT j FROM alc_pct),
        'moods', (SELECT j FROM md_pct),
        'tags', (SELECT j FROM tg_pct),
        'categories', (SELECT j FROM cat_pct)
      ),
      'followers', jsonb_build_object(
        'saves_on_picks', COALESCE((SELECT saves_on_picks FROM fol_agg), 0),
        'distinct_savers', COALESCE((SELECT distinct_savers FROM fol_agg), 0),
        'regions', (SELECT j FROM reg_json),
        'checkins_total', COALESCE((SELECT n FROM checkin_cnt), 0)
      )
    )
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.studio_archive_extended_insights(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_archive_extended_insights(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
