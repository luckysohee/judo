-- get_places_in_bounds: bbox places 먼저 → curator_places 전체 GROUP BY 제거 (홈 지도 TTFB)
-- + places (lat,lng), curator_places(place_id) 인덱스

CREATE INDEX IF NOT EXISTS idx_places_lat_lng_bbox ON public.places (lat, lng);

CREATE INDEX IF NOT EXISTS idx_curator_places_place_id_active
  ON public.curator_places (place_id)
  WHERE is_archived IS NOT TRUE;

CREATE OR REPLACE FUNCTION public.get_places_in_bounds(
  south double precision,
  west double precision,
  north double precision,
  east double precision,
  p_limit integer DEFAULT 80
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim int := greatest(1, least(coalesce(nullif(p_limit, 0), 80), 200));
  lat_min double precision;
  lat_max double precision;
  lng_min double precision;
  lng_max double precision;
BEGIN
  lat_min := LEAST(south, north);
  lat_max := GREATEST(south, north);
  lng_min := LEAST(west, east);
  lng_max := GREATEST(west, east);

  IF (lat_max - lat_min) > 3.0 OR (lng_max - lng_min) > 3.0 THEN
    RAISE EXCEPTION 'bounds_too_large' USING ERRCODE = '22023';
  END IF;

  RETURN (
    WITH bbox_places AS (
      SELECT
        p.id,
        p.name,
        p.category,
        p.lat,
        p.lng,
        p.tags,
        coalesce(p.address, '') AS address,
        ''::text AS address_name,
        ''::text AS road_address_name,
        ''::text AS place_url,
        p.kakao_place_id
      FROM public.places p
      WHERE p.lat BETWEEN lat_min AND lat_max
        AND p.lng BETWEEN lng_min AND lng_max
    ),
    curator_counts AS (
      SELECT
        cp.place_id,
        count(*)::int AS curator_cnt
      FROM public.curator_places cp
      INNER JOIN bbox_places bp ON bp.id = cp.place_id
      WHERE cp.is_archived IS DISTINCT FROM TRUE
      GROUP BY cp.place_id
    ),
    cand AS (
      SELECT
        bp.id,
        bp.name,
        bp.category,
        bp.lat,
        bp.lng,
        bp.tags,
        bp.address,
        bp.address_name,
        bp.road_address_name,
        bp.place_url,
        bp.kakao_place_id,
        coalesce(cc.curator_cnt, 0) AS curator_cnt
      FROM bbox_places bp
      LEFT JOIN curator_counts cc ON cc.place_id = bp.id
      ORDER BY
        (CASE WHEN coalesce(cc.curator_cnt, 0) > 0 THEN 0 ELSE 1 END),
        coalesce(cc.curator_cnt, 0) DESC,
        bp.id
      LIMIT lim
    ),
    places_json AS (
      SELECT coalesce(
        json_agg(
          json_build_object(
            'id', c.id,
            'name', c.name,
            'category', c.category,
            'lat', c.lat,
            'lng', c.lng,
            'tags', coalesce(to_jsonb(c.tags), '[]'::jsonb),
            'address', c.address,
            'address_name', c.address_name,
            'road_address_name', c.road_address_name,
            'place_url', c.place_url,
            'kakao_place_id',
              CASE
                WHEN c.kakao_place_id IS NULL THEN NULL
                ELSE c.kakao_place_id::text
              END
          )
          ORDER BY c.curator_cnt DESC, c.id
        ),
        '[]'::json
      ) AS j
      FROM cand c
    ),
    join_rows_json AS (
      SELECT coalesce(
        json_agg(
          json_build_object(
            'place_id', cp.place_id,
            'is_archived', (cp.is_archived IS TRUE),
            'one_line_reason', coalesce(cp.one_line_reason, ''),
            'menu_reason', ''::text,
            'one_line_review', coalesce(cp.one_line_review, ''),
            'tags', coalesce(to_jsonb(cp.tags), '[]'::jsonb),
            'moods', coalesce(to_jsonb(cp.moods), '[]'::jsonb),
            'curators', json_build_object(
              'username', coalesce(cu.username, ''),
              'display_name', coalesce(cu.display_name, '')
            ),
            'places', json_build_object(
              'id', p.id,
              'name', p.name,
              'category', p.category,
              'lat', p.lat,
              'lng', p.lng,
              'tags', coalesce(to_jsonb(p.tags), '[]'::jsonb),
              'address', coalesce(p.address, ''),
              'address_name', ''::text,
              'road_address_name', ''::text,
              'place_url', ''::text,
              'kakao_place_id',
                CASE
                  WHEN p.kakao_place_id IS NULL THEN NULL
                  ELSE p.kakao_place_id::text
                END
            )
          )
        ),
        '[]'::json
      ) AS j
      FROM public.curator_places cp
      INNER JOIN cand ON cand.id = cp.place_id
      INNER JOIN public.places p ON p.id = cp.place_id
      INNER JOIN public.curators cu ON cu.user_id = cp.curator_id
      WHERE cp.is_archived IS DISTINCT FROM TRUE
    )
    SELECT json_build_object(
      'places', (SELECT j FROM places_json),
      'join_rows', (SELECT j FROM join_rows_json)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_places_in_bounds(double precision, double precision, double precision, double precision, integer) IS
  '지도 bbox: bbox 내 places 먼저 → 큐레이터 수 우선 상한(최대 200). service_role 전용.';

REVOKE ALL ON FUNCTION public.get_places_in_bounds(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_places_in_bounds(double precision, double precision, double precision, double precision, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
