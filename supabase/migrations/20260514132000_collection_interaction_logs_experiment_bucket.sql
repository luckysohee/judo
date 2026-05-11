-- collection_interaction_logs: experiment bucket 컬럼 추가 (A/B CTR 비교용)

ALTER TABLE public.collection_interaction_logs
  ADD COLUMN IF NOT EXISTS experiment_bucket TEXT;

CREATE INDEX IF NOT EXISTS idx_collection_interaction_logs_section_bucket_created
  ON public.collection_interaction_logs (source_section, experiment_bucket, created_at DESC);

