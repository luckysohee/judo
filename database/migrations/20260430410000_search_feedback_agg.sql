-- 검색 로그 정규화 + 클릭-검색 FK + 검색어별 장소 반응 집계(CTR·보수적 behavior_score)
-- supabase/migrations/20260430410000_search_feedback_agg.sql 과 동일

BEGIN;

ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS normalized_query TEXT;

COMMENT ON COLUMN public.search_logs.normalized_query IS
  '검색어 정규화(소문자·공백) — search_place_feedback·집계 조인용';

CREATE INDEX IF NOT EXISTS idx_search_logs_normalized_query
  ON public.search_logs (normalized_query)
  WHERE normalized_query IS NOT NULL;

-- `search_logs.id` 는 bigint 인 배포가 많음 — uuid FK 는 42804 로 실패함
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'place_click_logs'
      AND c.column_name = 'search_log_id'
      AND c.data_type = 'uuid'
  ) THEN
    ALTER TABLE public.place_click_logs
      DROP CONSTRAINT IF EXISTS place_click_logs_search_log_id_fkey;
    ALTER TABLE public.place_click_logs DROP COLUMN search_log_id;
  END IF;
END $$;

ALTER TABLE public.place_click_logs
  ADD COLUMN IF NOT EXISTS search_log_id BIGINT REFERENCES public.search_logs(id) ON DELETE SET NULL;

ALTER TABLE public.place_click_logs
  ADD COLUMN IF NOT EXISTS user_query TEXT;

ALTER TABLE public.place_click_logs
  ADD COLUMN IF NOT EXISTS normalized_query TEXT;

COMMENT ON COLUMN public.place_click_logs.search_log_id IS
  '검색 제출 1행(search_logs.id) — 세션과 별도로 정확한 검색-클릭 조인';

CREATE INDEX IF NOT EXISTS idx_place_click_logs_search_log_id
  ON public.place_click_logs (search_log_id)
  WHERE search_log_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_place_click_logs_normalized_query
  ON public.place_click_logs (normalized_query)
  WHERE normalized_query IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.search_place_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_query TEXT NOT NULL,
  area TEXT,
  intent_tags TEXT[],
  place_key TEXT NOT NULL,
  place_uuid UUID REFERENCES public.places(id) ON DELETE SET NULL,
  impression_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,
  checkin_count INTEGER NOT NULL DEFAULT 0,
  ctr DOUBLE PRECISION NOT NULL DEFAULT 0,
  behavior_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT search_place_feedback_query_place UNIQUE (normalized_query, place_key)
);

COMMENT ON TABLE public.search_place_feedback IS
  '검색어·장소별 노출·클릭·저장·체크인 집계. 추천 점수는 log형 소가산만(앱에서 cap).';

CREATE INDEX IF NOT EXISTS idx_search_place_feedback_query
  ON public.search_place_feedback (normalized_query);

ALTER TABLE public.search_place_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read search_place_feedback" ON public.search_place_feedback;
CREATE POLICY "Anyone can read search_place_feedback"
  ON public.search_place_feedback
  FOR SELECT
  USING (true);

REVOKE ALL ON public.search_place_feedback FROM PUBLIC;
GRANT SELECT ON public.search_place_feedback TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._search_place_feedback_recalc(p_impr int, p_clk int, p_sav int, p_chk int)
RETURNS TABLE(ctr_out double precision, score_out double precision)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE WHEN p_impr > 0 THEN (p_clk::double precision / p_impr) ELSE 0::double precision END,
    (p_clk * 1.0 + p_sav * 3.0 + p_chk * 5.0)::double precision;
$$;

CREATE OR REPLACE FUNCTION public.increment_search_place_feedback_impressions(
  p_normalized_query text,
  p_area text,
  p_intent_tags text[],
  p_place_keys text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  v_impr int;
  v_clk int;
  v_sav int;
  v_chk int;
  v_ctr double precision;
  v_score double precision;
  v_pu uuid;
BEGIN
  IF p_normalized_query IS NULL OR btrim(p_normalized_query) = '' OR p_place_keys IS NULL THEN
    RETURN;
  END IF;
  FOREACH k IN ARRAY p_place_keys
  LOOP
    IF k IS NULL OR btrim(k) = '' THEN
      CONTINUE;
    END IF;
    v_pu := NULL;
    IF k ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      BEGIN
        v_pu := k::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_pu := NULL;
      END;
    END IF;
    INSERT INTO public.search_place_feedback (
      normalized_query, area, intent_tags, place_key, place_uuid,
      impression_count, click_count, save_count, checkin_count, ctr, behavior_score, updated_at
    )
    VALUES (
      btrim(p_normalized_query),
      NULLIF(btrim(p_area), ''),
      p_intent_tags,
      btrim(k),
      v_pu,
      1, 0, 0, 0, 0, 0, now()
    )
    ON CONFLICT (normalized_query, place_key) DO UPDATE SET
      impression_count = public.search_place_feedback.impression_count + 1,
      area = COALESCE(EXCLUDED.area, public.search_place_feedback.area),
      intent_tags = CASE
        WHEN EXCLUDED.intent_tags IS NOT NULL AND cardinality(EXCLUDED.intent_tags) > 0
        THEN EXCLUDED.intent_tags
        ELSE public.search_place_feedback.intent_tags
      END,
      place_uuid = COALESCE(public.search_place_feedback.place_uuid, EXCLUDED.place_uuid),
      updated_at = now();

    SELECT impression_count, click_count, save_count, checkin_count
    INTO v_impr, v_clk, v_sav, v_chk
    FROM public.search_place_feedback
    WHERE normalized_query = btrim(p_normalized_query) AND place_key = btrim(k);

    SELECT ctr_out, score_out INTO v_ctr, v_score
    FROM public._search_place_feedback_recalc(v_impr, v_clk, v_sav, v_chk);

    UPDATE public.search_place_feedback
    SET ctr = v_ctr, behavior_score = v_score
    WHERE normalized_query = btrim(p_normalized_query) AND place_key = btrim(k);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_search_place_feedback_click(
  p_normalized_query text,
  p_area text,
  p_intent_tags text[],
  p_place_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_impr int;
  v_clk int;
  v_sav int;
  v_chk int;
  v_ctr double precision;
  v_score double precision;
  v_pu uuid;
  bk text;
BEGIN
  bk := btrim(p_place_key);
  IF p_normalized_query IS NULL OR btrim(p_normalized_query) = '' OR bk = '' THEN
    RETURN;
  END IF;
  v_pu := NULL;
  IF bk ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    BEGIN
      v_pu := bk::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_pu := NULL;
    END;
  END IF;

  INSERT INTO public.search_place_feedback (
    normalized_query, area, intent_tags, place_key, place_uuid,
    impression_count, click_count, save_count, checkin_count, ctr, behavior_score, updated_at
  )
  VALUES (
    btrim(p_normalized_query),
    NULLIF(btrim(p_area), ''),
    p_intent_tags,
    bk,
    v_pu,
    0, 1, 0, 0, 0, 0, now()
  )
  ON CONFLICT (normalized_query, place_key) DO UPDATE SET
    click_count = public.search_place_feedback.click_count + 1,
    area = COALESCE(EXCLUDED.area, public.search_place_feedback.area),
    intent_tags = CASE
      WHEN EXCLUDED.intent_tags IS NOT NULL AND cardinality(EXCLUDED.intent_tags) > 0
      THEN EXCLUDED.intent_tags
      ELSE public.search_place_feedback.intent_tags
    END,
    place_uuid = COALESCE(public.search_place_feedback.place_uuid, EXCLUDED.place_uuid),
    updated_at = now();

  SELECT impression_count, click_count, save_count, checkin_count
  INTO v_impr, v_clk, v_sav, v_chk
  FROM public.search_place_feedback
  WHERE normalized_query = btrim(p_normalized_query) AND place_key = bk;

  SELECT ctr_out, score_out INTO v_ctr, v_score
  FROM public._search_place_feedback_recalc(v_impr, v_clk, v_sav, v_chk);

  UPDATE public.search_place_feedback
  SET ctr = v_ctr, behavior_score = v_score
  WHERE normalized_query = btrim(p_normalized_query) AND place_key = bk;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_search_place_feedback_save(
  p_normalized_query text,
  p_area text,
  p_intent_tags text[],
  p_place_key text,
  p_delta int DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_impr int;
  v_clk int;
  v_sav int;
  v_chk int;
  v_ctr double precision;
  v_score double precision;
  v_pu uuid;
  bk text;
  d int;
BEGIN
  bk := btrim(p_place_key);
  d := GREATEST(1, LEAST(COALESCE(p_delta, 1), 20));
  IF p_normalized_query IS NULL OR btrim(p_normalized_query) = '' OR bk = '' THEN
    RETURN;
  END IF;
  v_pu := NULL;
  IF bk ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    BEGIN
      v_pu := bk::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_pu := NULL;
    END;
  END IF;

  INSERT INTO public.search_place_feedback (
    normalized_query, area, intent_tags, place_key, place_uuid,
    impression_count, click_count, save_count, checkin_count, ctr, behavior_score, updated_at
  )
  VALUES (
    btrim(p_normalized_query),
    NULLIF(btrim(p_area), ''),
    p_intent_tags,
    bk,
    v_pu,
    0, 0, d, 0, 0, 0, now()
  )
  ON CONFLICT (normalized_query, place_key) DO UPDATE SET
    save_count = public.search_place_feedback.save_count + d,
    area = COALESCE(EXCLUDED.area, public.search_place_feedback.area),
    intent_tags = CASE
      WHEN EXCLUDED.intent_tags IS NOT NULL AND cardinality(EXCLUDED.intent_tags) > 0
      THEN EXCLUDED.intent_tags
      ELSE public.search_place_feedback.intent_tags
    END,
    place_uuid = COALESCE(public.search_place_feedback.place_uuid, EXCLUDED.place_uuid),
    updated_at = now();

  SELECT impression_count, click_count, save_count, checkin_count
  INTO v_impr, v_clk, v_sav, v_chk
  FROM public.search_place_feedback
  WHERE normalized_query = btrim(p_normalized_query) AND place_key = bk;

  SELECT ctr_out, score_out INTO v_ctr, v_score
  FROM public._search_place_feedback_recalc(v_impr, v_clk, v_sav, v_chk);

  UPDATE public.search_place_feedback
  SET ctr = v_ctr, behavior_score = v_score
  WHERE normalized_query = btrim(p_normalized_query) AND place_key = bk;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_search_place_feedback_impressions(text, text, text[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_search_place_feedback_impressions(text, text, text[], text[]) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.increment_search_place_feedback_click(text, text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_search_place_feedback_click(text, text, text[], text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.increment_search_place_feedback_save(text, text, text[], text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_search_place_feedback_save(text, text, text[], text, int) TO anon, authenticated, service_role;

COMMIT;
