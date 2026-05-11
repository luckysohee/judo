-- home_section_impression_logs: experiment bucket 컬럼 추가 (A/B CTR 비교용)

ALTER TABLE public.home_section_impression_logs
  ADD COLUMN IF NOT EXISTS experiment_bucket TEXT;

CREATE INDEX IF NOT EXISTS idx_home_section_impr_section_bucket_created
  ON public.home_section_impression_logs (section_name, experiment_bucket, created_at DESC);

