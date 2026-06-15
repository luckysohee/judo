-- search_logs / place_click_logs: SECURITY DEFINER RPC (RLS·만료 JWT 우회)
-- Supabase: supabase/migrations/20260615110000_search_logs_insert_rpc.sql

CREATE OR REPLACE FUNCTION public.insert_search_log_analytics(p_row jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_uid text;
  v_tags text[];
BEGIN
  IF p_row IS NULL OR COALESCE(p_row->>'user_query', '') = '' THEN
    RETURN NULL;
  END IF;

  v_uid := COALESCE(auth.uid()::text, 'anonymous');

  IF p_row ? 'parsed_tags_normalized' AND jsonb_typeof(p_row->'parsed_tags_normalized') = 'array' THEN
    SELECT COALESCE(array_agg(t), ARRAY[]::text[])
    INTO v_tags
    FROM jsonb_array_elements_text(p_row->'parsed_tags_normalized') AS t;
  ELSE
    v_tags := NULL;
  END IF;

  INSERT INTO public.search_logs (
    session_id,
    user_query,
    normalized_query,
    parsed_region,
    parsed_alcohol,
    parsed_vibe,
    parsed_purpose,
    parsed_food,
    parsed_tags_normalized,
    search_mode,
    had_client_error,
    search_results_ids,
    has_results,
    results_count,
    bookmarked,
    submit_user_visible_candidate_count,
    submit_initial_search_kind,
    submit_keyword_ai_fallback,
    user_id,
    is_logged_in,
    user_type
  ) VALUES (
    NULLIF(p_row->>'session_id', '')::uuid,
    p_row->>'user_query',
    NULLIF(p_row->>'normalized_query', ''),
    NULLIF(p_row->>'parsed_region', ''),
    NULLIF(p_row->>'parsed_alcohol', ''),
    NULLIF(p_row->>'parsed_vibe', ''),
    NULLIF(p_row->>'parsed_purpose', ''),
    NULLIF(p_row->>'parsed_food', ''),
    v_tags,
    NULLIF(p_row->>'search_mode', ''),
    COALESCE((p_row->>'had_client_error')::boolean, false),
    CASE
      WHEN p_row ? 'search_results_ids' AND jsonb_typeof(p_row->'search_results_ids') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_row->'search_results_ids'))
      ELSE ARRAY[]::text[]
    END,
    COALESCE((p_row->>'has_results')::boolean, false),
    COALESCE((p_row->>'results_count')::integer, 0),
    false,
    CASE
      WHEN p_row ? 'submit_user_visible_candidate_count'
        AND (p_row->>'submit_user_visible_candidate_count') ~ '^-?[0-9]+$'
        THEN (p_row->>'submit_user_visible_candidate_count')::integer
      ELSE NULL
    END,
    NULLIF(p_row->>'submit_initial_search_kind', ''),
    COALESCE((p_row->>'submit_keyword_ai_fallback')::boolean, false),
    v_uid,
    auth.uid() IS NOT NULL,
    CASE WHEN auth.uid() IS NOT NULL THEN 'registered' ELSE 'anonymous' END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_place_click_log_analytics(p_row jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text;
BEGIN
  IF p_row IS NULL OR COALESCE(p_row->>'clicked_place_id', '') = '' THEN
    RETURN;
  END IF;

  v_uid := COALESCE(auth.uid()::text, 'anonymous');

  INSERT INTO public.place_click_logs (
    clicked_place_id,
    clicked_curator_id,
    place_name,
    search_session_id,
    search_log_id,
    user_query,
    normalized_query,
    source,
    search_click_path,
    clicked_rank,
    user_visible_candidate_count,
    user_id,
    is_logged_in,
    user_type
  ) VALUES (
    p_row->>'clicked_place_id',
    NULLIF(p_row->>'clicked_curator_id', ''),
    COALESCE(NULLIF(p_row->>'place_name', ''), '(unknown)'),
    NULLIF(p_row->>'search_session_id', '')::uuid,
    CASE
      WHEN p_row ? 'search_log_id' AND (p_row->>'search_log_id') ~ '^[0-9]+$'
        THEN (p_row->>'search_log_id')::bigint
      ELSE NULL
    END,
    NULLIF(p_row->>'user_query', ''),
    NULLIF(p_row->>'normalized_query', ''),
    COALESCE(NULLIF(p_row->>'source', ''), 'search_result'),
    NULLIF(p_row->>'search_click_path', ''),
    CASE
      WHEN p_row ? 'clicked_rank' AND (p_row->>'clicked_rank') ~ '^[0-9]+$'
        THEN (p_row->>'clicked_rank')::integer
      ELSE NULL
    END,
    CASE
      WHEN p_row ? 'user_visible_candidate_count'
        AND (p_row->>'user_visible_candidate_count') ~ '^-?[0-9]+$'
        THEN (p_row->>'user_visible_candidate_count')::integer
      ELSE NULL
    END,
    v_uid,
    auth.uid() IS NOT NULL,
    CASE WHEN auth.uid() IS NOT NULL THEN 'registered' ELSE 'anonymous' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.insert_search_log_analytics(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_place_click_log_analytics(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_search_log_analytics(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_place_click_log_analytics(jsonb) TO anon, authenticated;
