-- 큐레이터 추천 텍스트 검색(pg_trgm) + 의미 검색(pgvector)
-- 적용: Supabase SQL Editor 또는 migration 파이프라인
-- 사전 조건: public.curator_places, public.places, public.haversine_meters (20260412 마이그레이션)
--
-- HNSW 인덱스 생성이 실패하면(구버전 pgvector 등) 해당 CREATE INDEX 블록만 주석 처리해도
-- RPC는 동작합니다(정렬 시 순차 스캔). 데이터 적재 후 ivfflat 인덱스를 검토할 수 있습니다.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.curator_places
  ADD COLUMN IF NOT EXISTS one_line_embedding vector(1536);

COMMENT ON COLUMN public.curator_places.one_line_embedding IS
  'OpenAI text-embedding-3-small 등 1536차원. scripts/backfill-curator-place-embeddings.mjs 로 채움.';

-- 한줄평 부분 일치·유사도
CREATE INDEX IF NOT EXISTS curator_places_one_line_reason_trgm_idx
  ON public.curator_places
  USING gin (one_line_reason gin_trgm_ops);

-- 코사인 유사도 순 정렬 가속 (임베딩이 있는 행만)
CREATE INDEX IF NOT EXISTS curator_places_one_line_embedding_hnsw_idx
  ON public.curator_places
  USING hnsw (one_line_embedding vector_cosine_ops)
  WHERE one_line_embedding IS NOT NULL;

-- 검색용 텍스트: 한줄평 + 태그·무드·주종 (한글은 morph 없이 trgm 위주)
CREATE OR REPLACE FUNCTION public.curator_place_search_blob(cp public.curator_places)
RETURNS text
LANGUAGE sql
STABLE
AS $func$
  SELECT TRIM(
    COALESCE(cp.one_line_reason, '') || ' ' ||
    COALESCE(array_to_string(cp.tags, ' '), '') || ' ' ||
    COALESCE(array_to_string(cp.moods, ' '), '') || ' ' ||
    COALESCE(array_to_string(cp.alcohol_types, ' '), '')
  );
$func$;

CREATE OR REPLACE FUNCTION public.search_curator_places_trgm(
  p_query text,
  p_curator_id uuid DEFAULT NULL,
  p_limit int DEFAULT 40,
  p_max_distance_m double precision DEFAULT NULL,
  p_origin_lat double precision DEFAULT NULL,
  p_origin_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  curator_place_id uuid,
  place_id uuid,
  text_score double precision,
  distance_m double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    ranked.curator_place_id,
    ranked.place_id,
    ranked.text_score,
    ranked.distance_m
  FROM (
    SELECT
      cp.id AS curator_place_id,
      cp.place_id,
      GREATEST(
        similarity(
          public.curator_place_search_blob(cp),
          TRIM(COALESCE(p_query, ''))
        ),
        CASE
          WHEN public.curator_place_search_blob(cp) ILIKE '%' || TRIM(COALESCE(p_query, '')) || '%'
          THEN 0.25::double precision
          ELSE 0::double precision
        END
      ) AS text_score,
      CASE
        WHEN p_origin_lat IS NULL OR p_origin_lng IS NULL OR pl.lat IS NULL OR pl.lng IS NULL THEN NULL
        ELSE public.haversine_meters(
          p_origin_lat,
          p_origin_lng,
          pl.lat::double precision,
          pl.lng::double precision
        )
      END AS distance_m
    FROM public.curator_places cp
    INNER JOIN public.places pl ON pl.id = cp.place_id
    WHERE cp.is_archived = false
      AND (p_curator_id IS NULL OR cp.curator_id = p_curator_id)
      AND TRIM(COALESCE(p_query, '')) <> ''
      AND TRIM(public.curator_place_search_blob(cp)) <> ''
      AND (
        public.curator_place_search_blob(cp) ILIKE '%' || TRIM(p_query) || '%'
        OR similarity(
          public.curator_place_search_blob(cp),
          TRIM(COALESCE(p_query, ''))
        ) > 0.06
      )
  ) ranked
  WHERE
    p_max_distance_m IS NULL
    OR ranked.distance_m IS NULL
    OR ranked.distance_m <= p_max_distance_m
  ORDER BY ranked.text_score DESC NULLS LAST, ranked.distance_m ASC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 200);
$func$;

CREATE OR REPLACE FUNCTION public.search_curator_places_vector(
  p_query_embedding vector(1536),
  p_curator_id uuid DEFAULT NULL,
  p_limit int DEFAULT 40,
  p_max_distance_m double precision DEFAULT NULL,
  p_origin_lat double precision DEFAULT NULL,
  p_origin_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  curator_place_id uuid,
  place_id uuid,
  vector_score double precision,
  distance_m double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    cp.id AS curator_place_id,
    cp.place_id,
    (1::double precision - (cp.one_line_embedding <=> p_query_embedding))::double precision AS vector_score,
    CASE
      WHEN p_origin_lat IS NULL OR p_origin_lng IS NULL OR pl.lat IS NULL OR pl.lng IS NULL THEN NULL
      ELSE public.haversine_meters(
        p_origin_lat,
        p_origin_lng,
        pl.lat::double precision,
        pl.lng::double precision
      )
    END AS distance_m
  FROM public.curator_places cp
  INNER JOIN public.places pl ON pl.id = cp.place_id
  WHERE cp.is_archived = false
    AND cp.one_line_embedding IS NOT NULL
    AND (p_curator_id IS NULL OR cp.curator_id = p_curator_id)
    AND (
      p_max_distance_m IS NULL
      OR pl.lat IS NULL
      OR pl.lng IS NULL
      OR p_origin_lat IS NULL
      OR p_origin_lng IS NULL
      OR public.haversine_meters(
        p_origin_lat,
        p_origin_lng,
        pl.lat::double precision,
        pl.lng::double precision
      ) <= p_max_distance_m
    )
  ORDER BY cp.one_line_embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 200);
$func$;

GRANT EXECUTE ON FUNCTION public.search_curator_places_trgm(
  text, uuid, int, double precision, double precision, double precision
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.search_curator_places_vector(
  vector(1536), uuid, int, double precision, double precision, double precision
) TO anon, authenticated, service_role;
