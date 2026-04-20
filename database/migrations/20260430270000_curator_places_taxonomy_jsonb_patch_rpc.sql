-- curator_places.tags / moods / alcohol_types: text[]·누락 혼재 → jsonb 통일 + 검색 blob 보정
-- 클라이언트 upsert 후 studio_patch_curator_place_taxonomy RPC로도 한 번 더 기록(SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.curator_place_jsonb_arr_to_space_text(j jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN j IS NULL OR jsonb_typeof(j) <> 'array' THEN ''
    ELSE COALESCE((
      SELECT string_agg(elem, ' ')
      FROM jsonb_array_elements_text(j) AS t(elem)
    ), '')
  END;
$$;

COMMENT ON FUNCTION public.curator_place_jsonb_arr_to_space_text(jsonb) IS
  'curator_place_search_blob: jsonb 배열 → 공백 구분 문자열';

-- 기존 array_to_string(cp.tags, ...) 는 tags 가 jsonb 이면 깨짐 → jsonb 전제로 통일
CREATE OR REPLACE FUNCTION public.curator_place_search_blob(cp public.curator_places)
RETURNS text
LANGUAGE sql
STABLE
AS $func$
  SELECT TRIM(
    COALESCE(cp.one_line_reason, '') || ' ' ||
    COALESCE(public.curator_place_jsonb_arr_to_space_text(cp.tags), '') || ' ' ||
    COALESCE(public.curator_place_jsonb_arr_to_space_text(cp.moods), '') || ' ' ||
    COALESCE(public.curator_place_jsonb_arr_to_space_text(cp.alcohol_types), '')
  );
$func$;

DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['tags', 'moods', 'alcohol_types']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'curator_places'
        AND column_name = col
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.curator_places ADD COLUMN %I jsonb NOT NULL DEFAULT ''[]''::jsonb',
        col
      );
    ELSE
      -- text[] → jsonb
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'curator_places'
          AND column_name = col
          AND udt_name = '_text'
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.curator_places ALTER COLUMN %I TYPE jsonb USING to_jsonb(%I)',
          col,
          col
        );
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.studio_patch_curator_place_taxonomy(
  p_place_id uuid,
  p_tags jsonb DEFAULT '[]'::jsonb,
  p_moods jsonb DEFAULT '[]'::jsonb,
  p_alcohol_types jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF p_place_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.curator_places
  SET
    tags = COALESCE(NULLIF(p_tags, 'null'::jsonb), '[]'::jsonb),
    moods = COALESCE(NULLIF(p_moods, 'null'::jsonb), '[]'::jsonb),
    alcohol_types = COALESCE(NULLIF(p_alcohol_types, 'null'::jsonb), '[]'::jsonb)
  WHERE place_id = p_place_id
    AND curator_id = auth.uid();
END;
$func$;

REVOKE ALL ON FUNCTION public.studio_patch_curator_place_taxonomy(uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_patch_curator_place_taxonomy(uuid, jsonb, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.studio_patch_curator_place_taxonomy(uuid, jsonb, jsonb, jsonb) IS
  '잔 올리기: tags/moods/alcohol_types jsonb 배열 강제 저장 (본인 행만)';

NOTIFY pgrst, 'reload schema';
