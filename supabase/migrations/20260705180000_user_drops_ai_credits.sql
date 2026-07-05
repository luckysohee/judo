-- 일반 유저 Drop · AI Credit (홈 AI 코스 등 — Studio Pro와 별도)

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
