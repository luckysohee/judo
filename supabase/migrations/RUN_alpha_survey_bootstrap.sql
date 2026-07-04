-- Supabase SQL Editor: 테이블이 없을 때 이 파일 전체를 한 번 실행하세요.

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

NOTIFY pgrst, 'reload schema';
