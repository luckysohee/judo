-- 가입·설문 취향 시드 — GPT 없이 룰 추천·「오늘 여기」에 사용
CREATE TABLE IF NOT EXISTS public.user_taste_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  liquor_types text[] NOT NULL DEFAULT '{}',
  vibes text[] NOT NULL DEFAULT '{}',
  situations text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',
  party_size smallint,
  prefer_walkable boolean NOT NULL DEFAULT false,
  onboarding_status text NOT NULL DEFAULT 'pending'
    CHECK (onboarding_status IN ('pending', 'completed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_taste_preferences IS
  '사용자 취향 설문 시드 + 이후 행동 데이터 보강용. 주종·분위기는 placeTaxonomy 표준값.';

ALTER TABLE public.user_taste_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_taste_preferences_select_own" ON public.user_taste_preferences;
DROP POLICY IF EXISTS "user_taste_preferences_insert_own" ON public.user_taste_preferences;
DROP POLICY IF EXISTS "user_taste_preferences_update_own" ON public.user_taste_preferences;

CREATE POLICY "user_taste_preferences_select_own"
  ON public.user_taste_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_taste_preferences_insert_own"
  ON public.user_taste_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_taste_preferences_update_own"
  ON public.user_taste_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
