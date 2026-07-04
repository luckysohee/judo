-- 알파 설문: 작성 중(draft) vs 제출 완료 구분
ALTER TABLE public.alpha_survey_responses
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

COMMENT ON COLUMN public.alpha_survey_responses.submitted_at IS
  'NULL = 자동 임시저장(작성 중), NOT NULL = 사용자가 제출 완료';

CREATE INDEX IF NOT EXISTS alpha_survey_responses_submitted_at_idx
  ON public.alpha_survey_responses (submitted_at DESC NULLS LAST);

NOTIFY pgrst, 'reload schema';
