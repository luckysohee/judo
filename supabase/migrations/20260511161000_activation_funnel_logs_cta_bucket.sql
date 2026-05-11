-- activation_funnel_logs: activation CTA experiment bucket

ALTER TABLE public.activation_funnel_logs
  ADD COLUMN IF NOT EXISTS activation_cta_bucket TEXT;

CREATE INDEX IF NOT EXISTS idx_activation_funnel_cta_event_created
  ON public.activation_funnel_logs (activation_cta_bucket, event_name, created_at DESC);

