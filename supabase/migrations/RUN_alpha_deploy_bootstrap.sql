-- =============================================================================
-- 알파 배포 — Supabase SQL Editor에서 이 파일 전체를 한 번 실행
-- =============================================================================
-- 순서 (멱등 — 이미 적용된 구문은 IF NOT EXISTS / OR REPLACE 로 스킵):
--   1) curator_places.one_line_review / menu_reason  → 지도 bbox RPC 42703 방지
--   2) alpha_survey_responses                        → 홈 「피드백」 설문
--   3) studio_pro + AI 코스 초안 쿼터
--   4) 기존 큐레이터 Studio Pro grandfather
--   5) user_wallets / Drop · AI Credit
--
-- 실행 후 맨 아래 VERIFY 쿼리 결과를 확인하세요.
-- =============================================================================

-- ── 1) 지도 · 큐레이터 장소 컬럼 ───────────────────────────────────────────
-- 원본: 20260628120000_curator_places_add_one_line_review_menu_reason.sql

ALTER TABLE public.curator_places
  ADD COLUMN IF NOT EXISTS one_line_review text;

ALTER TABLE public.curator_places
  ADD COLUMN IF NOT EXISTS menu_reason text;

COMMENT ON COLUMN public.curator_places.one_line_review IS
  '선택 한 줄 리뷰(보조). 주 추천 사유는 one_line_reason.';
COMMENT ON COLUMN public.curator_places.menu_reason IS
  '선택 메뉴 추천 사유(보조).';

-- ── 2) 알파 피드백 설문 ─────────────────────────────────────────────────────
-- 원본: 20260704120000_alpha_survey_responses.sql

CREATE TABLE IF NOT EXISTS public.alpha_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  survey_version text NOT NULL DEFAULT 'v1',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alpha_survey_responses_user_version_key UNIQUE (user_id, survey_version)
);

COMMENT ON TABLE public.alpha_survey_responses IS
  '알파 배포 피드백 설문 — 사용자별 최신 답변(버전당 1행 upsert).';

COMMENT ON COLUMN public.alpha_survey_responses.submitted_at IS
  'NULL = 자동 임시저장(작성 중), NOT NULL = 사용자가 제출 완료';

CREATE INDEX IF NOT EXISTS alpha_survey_responses_updated_at_idx
  ON public.alpha_survey_responses (updated_at DESC);

CREATE INDEX IF NOT EXISTS alpha_survey_responses_version_idx
  ON public.alpha_survey_responses (survey_version);

CREATE INDEX IF NOT EXISTS alpha_survey_responses_submitted_at_idx
  ON public.alpha_survey_responses (submitted_at DESC NULLS LAST);

ALTER TABLE public.alpha_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alpha_survey_select_own" ON public.alpha_survey_responses;
DROP POLICY IF EXISTS "alpha_survey_insert_own" ON public.alpha_survey_responses;
DROP POLICY IF EXISTS "alpha_survey_update_own" ON public.alpha_survey_responses;
DROP POLICY IF EXISTS "alpha_survey_admin_select" ON public.alpha_survey_responses;

CREATE POLICY "alpha_survey_select_own"
  ON public.alpha_survey_responses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "alpha_survey_insert_own"
  ON public.alpha_survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "alpha_survey_update_own"
  ON public.alpha_survey_responses
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "alpha_survey_admin_select"
  ON public.alpha_survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ── 3) Studio Pro + AI 코스 초안 쿼터 ───────────────────────────────────────
-- 원본: 20260705160000_studio_pro_ai_course_suggestion_quota.sql

ALTER TABLE public.curators
  ADD COLUMN IF NOT EXISTS studio_pro_until timestamptz;

COMMENT ON COLUMN public.curators.studio_pro_until IS
  'Studio Pro 만료 시각. NULL 또는 과거면 무료 티어(AI 코스 초안 월 5회).';

CREATE TABLE IF NOT EXISTS public.curator_studio_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id uuid NOT NULL REFERENCES public.curators (user_id) ON DELETE CASCADE,
  feature text NOT NULL DEFAULT 'ai_course_suggestion',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curator_studio_ai_usage_feature_chk CHECK (
    feature IN ('ai_course_suggestion')
  )
);

CREATE INDEX IF NOT EXISTS idx_curator_studio_ai_usage_month
  ON public.curator_studio_ai_usage (curator_id, feature, created_at DESC);

ALTER TABLE public.curator_studio_ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curator_studio_ai_usage_select_own ON public.curator_studio_ai_usage;
CREATE POLICY curator_studio_ai_usage_select_own
  ON public.curator_studio_ai_usage
  FOR SELECT
  TO authenticated
  USING (curator_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_studio_pro_curator(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.curators c
    WHERE c.user_id = p_user_id
      AND c.studio_pro_until IS NOT NULL
      AND c.studio_pro_until > now()
  );
$$;

CREATE OR REPLACE FUNCTION public._studio_ai_course_month_start_kst()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc(
    'month',
    (now() AT TIME ZONE 'Asia/Seoul')
  ) AT TIME ZONE 'Asia/Seoul';
$$;

CREATE OR REPLACE FUNCTION public._studio_ai_course_used_this_month(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.curator_studio_ai_usage u
  WHERE u.curator_id = p_user_id
    AND u.feature = 'ai_course_suggestion'
    AND u.created_at >= public._studio_ai_course_month_start_kst();
$$;

CREATE OR REPLACE FUNCTION public.get_studio_ai_course_suggestion_quota(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid uuid := p_user_id;
  v_limit integer := 5;
  v_used integer;
  v_pro boolean;
BEGIN
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.curators c WHERE c.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_curator');
  END IF;

  v_pro := public.is_studio_pro_curator(v_uid);
  v_used := public._studio_ai_course_used_this_month(v_uid);

  RETURN jsonb_build_object(
    'ok', true,
    'is_pro', v_pro,
    'limit', CASE WHEN v_pro THEN NULL ELSE v_limit END,
    'used', v_used,
    'remaining',
      CASE WHEN v_pro THEN NULL ELSE greatest(0, v_limit - v_used) END,
    'period_label',
      to_char(
        public._studio_ai_course_month_start_kst() AT TIME ZONE 'Asia/Seoul',
        'YYYY-MM'
      )
  );
END;
$func$;

CREATE OR REPLACE FUNCTION public.try_consume_studio_ai_course_suggestion_for_user(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_limit integer := 5;
  v_used integer;
  v_pro boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'allowed', false, 'reason', 'no_user');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.curators c WHERE c.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'allowed', false, 'reason', 'not_curator');
  END IF;

  v_pro := public.is_studio_pro_curator(p_user_id);
  IF v_pro THEN
    INSERT INTO public.curator_studio_ai_usage (curator_id, feature)
    VALUES (p_user_id, 'ai_course_suggestion');
    RETURN jsonb_build_object(
      'ok', true,
      'allowed', true,
      'is_pro', true,
      'used', public._studio_ai_course_used_this_month(p_user_id),
      'remaining', NULL
    );
  END IF;

  v_used := public._studio_ai_course_used_this_month(p_user_id);
  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'ok', true,
      'allowed', false,
      'is_pro', false,
      'reason', 'quota_exceeded',
      'limit', v_limit,
      'used', v_used,
      'remaining', 0
    );
  END IF;

  INSERT INTO public.curator_studio_ai_usage (curator_id, feature)
  VALUES (p_user_id, 'ai_course_suggestion');

  RETURN jsonb_build_object(
    'ok', true,
    'allowed', true,
    'is_pro', false,
    'limit', v_limit,
    'used', v_used + 1,
    'remaining', greatest(0, v_limit - v_used - 1)
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.is_studio_pro_curator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_studio_ai_course_suggestion_quota(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_consume_studio_ai_course_suggestion_for_user(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_studio_ai_course_suggestion_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_consume_studio_ai_course_suggestion_for_user(uuid) TO service_role;

COMMENT ON FUNCTION public.get_studio_ai_course_suggestion_quota(uuid) IS
  '큐레이터 AI 코스 초안 — 이번 달 사용량(무료 5회 / Pro 무제한).';

CREATE OR REPLACE FUNCTION public.peek_studio_ai_course_suggestion_for_user(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_limit integer := 5;
  v_used integer;
  v_pro boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'allowed', false, 'reason', 'no_user');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.curators c WHERE c.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'allowed', false, 'reason', 'not_curator');
  END IF;

  v_pro := public.is_studio_pro_curator(p_user_id);
  v_used := public._studio_ai_course_used_this_month(p_user_id);

  IF v_pro THEN
    RETURN jsonb_build_object(
      'ok', true,
      'allowed', true,
      'is_pro', true,
      'used', v_used,
      'remaining', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'allowed', v_used < v_limit,
    'is_pro', false,
    'limit', v_limit,
    'used', v_used,
    'remaining', greatest(0, v_limit - v_used),
    'reason', CASE WHEN v_used >= v_limit THEN 'quota_exceeded' ELSE NULL END
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.peek_studio_ai_course_suggestion_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_studio_ai_course_suggestion_for_user(uuid) TO service_role;

COMMENT ON FUNCTION public.try_consume_studio_ai_course_suggestion_for_user(uuid) IS
  '서버 전용: AI 코스 초안 1회 차감 후 allowed 여부 반환.';

-- ── 4) 기존 큐레이터 Studio Pro grandfather ───────────────────────────────
-- 원본: 20260705170000_grandfather_studio_pro_curators.sql

DO $$
DECLARE
  v_pro_until timestamptz := timestamptz '2027-12-31 23:59:59+09';
  v_updated integer;
BEGIN
  UPDATE public.curators
  SET studio_pro_until = v_pro_until
  WHERE studio_pro_until IS NULL
     OR studio_pro_until < now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'grandfather_studio_pro: updated % curator(s)', v_updated;
END $$;

COMMENT ON COLUMN public.curators.studio_pro_until IS
  'Studio Pro 만료. NULL/과거=무료(AI 코스 초안 월 5회). 알파 이전 기존 큐레이터는 grandfather 마이그레이션으로 Pro 부여.';

-- ── 5) Drop · AI Credit ─────────────────────────────────────────────────────
-- 원본: 20260705180000_user_drops_ai_credits.sql

CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  drop_balance integer NOT NULL DEFAULT 0 CHECK (drop_balance >= 0),
  ai_credit_balance integer NOT NULL DEFAULT 0 CHECK (ai_credit_balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_wallets IS
  '일반 유저 Drop(적립) · AI Credit(소비) 잔액. Studio Pro studio_pro_until 과 무관.';

CREATE TABLE IF NOT EXISTS public.user_drop_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL,
  ref_type text,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_drop_ledger_user_created
  ON public.user_drop_ledger (user_id, created_at DESC);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_drop_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_wallets_select_own ON public.user_wallets;
CREATE POLICY user_wallets_select_own
  ON public.user_wallets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_drop_ledger_select_own ON public.user_drop_ledger;
CREATE POLICY user_drop_ledger_select_own
  ON public.user_drop_ledger
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._drops_per_ai_credit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 15;
$$;

CREATE OR REPLACE FUNCTION public._ensure_user_wallet(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_wallet(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := p_user_id;
  v_drops integer := 0;
  v_credits integer := 0;
  v_per integer := public._drops_per_ai_credit();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  PERFORM public._ensure_user_wallet(v_uid);

  SELECT w.drop_balance, w.ai_credit_balance
  INTO v_drops, v_credits
  FROM public.user_wallets w
  WHERE w.user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'drops', COALESCE(v_drops, 0),
    'ai_credits', COALESCE(v_credits, 0),
    'drops_per_ai_credit', v_per,
    'progress_drops', COALESCE(v_drops, 0) % v_per,
    'can_exchange', COALESCE(v_drops, 0) >= v_per
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.try_exchange_drops_for_ai_credit(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := p_user_id;
  v_per integer := public._drops_per_ai_credit();
  v_drops integer;
  v_credits integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', '로그인이 필요해요.');
  END IF;

  PERFORM public._ensure_user_wallet(v_uid);

  SELECT w.drop_balance, w.ai_credit_balance
  INTO v_drops, v_credits
  FROM public.user_wallets w
  WHERE w.user_id = v_uid
  FOR UPDATE;

  IF COALESCE(v_drops, 0) < v_per THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', format('Drop이 %s개 더 필요해요.', v_per - COALESCE(v_drops, 0)),
      'wallet', public.get_user_wallet(v_uid)
    );
  END IF;

  UPDATE public.user_wallets
  SET
    drop_balance = drop_balance - v_per,
    ai_credit_balance = ai_credit_balance + 1,
    updated_at = now()
  WHERE user_id = v_uid;

  INSERT INTO public.user_drop_ledger (user_id, delta, reason, ref_type)
  VALUES (v_uid, -v_per, 'exchange_ai_credit', 'ai_credit');

  RETURN jsonb_build_object(
    'ok', true,
    'wallet', public.get_user_wallet(v_uid)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_exchange_drops_for_ai_credit(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public._ensure_user_wallet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._drops_per_ai_credit() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFY — 아래 결과가 기대값과 맞는지 확인
-- =============================================================================

-- one_line_review, menu_reason → 2 rows
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'curator_places'
  AND column_name IN ('one_line_review', 'menu_reason')
ORDER BY column_name;

-- alpha_survey_responses, curator_studio_ai_usage, user_wallets → 각 1 row
SELECT 'alpha_survey_responses' AS tbl, to_regclass('public.alpha_survey_responses') IS NOT NULL AS ok
UNION ALL
SELECT 'curator_studio_ai_usage', to_regclass('public.curator_studio_ai_usage') IS NOT NULL
UNION ALL
SELECT 'user_wallets', to_regclass('public.user_wallets') IS NOT NULL;

-- Pro 큐레이터 수 (0이면 grandfather 확인)
SELECT
  count(*) AS total_curators,
  count(*) FILTER (WHERE studio_pro_until > now()) AS pro_now
FROM public.curators;
