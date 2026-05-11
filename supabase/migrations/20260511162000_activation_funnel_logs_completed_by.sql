-- activation_funnel_logs: activation_completed 이벤트용 completed_by

ALTER TABLE public.activation_funnel_logs
  ADD COLUMN IF NOT EXISTS completed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_activation_funnel_completed_by_created
  ON public.activation_funnel_logs (completed_by, created_at DESC);

