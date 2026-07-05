-- Studio Pro + AI 코스 초안 월간 쿼터 (무료 5회 / Pro 무제한)
-- supabase/migrations/20260705160000_studio_pro_ai_course_suggestion_quota.sql 와 동일

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

GRANT EXECUTE ON FUNCTION public.try_consume_studio_ai_course_suggestion_for_user(uuid) TO service_role;
