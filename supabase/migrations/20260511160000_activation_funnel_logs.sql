-- activation funnel logs (first session)
-- 목적: first-time 유저가 홈에서 저장/픽/컬렉션 생성으로 이어지는지 측정

CREATE TABLE IF NOT EXISTS public.activation_funnel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  session_id UUID,
  experiment_bucket TEXT,
  app_env TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.activation_funnel_logs IS
  'first session activation funnel logs. client INSERT only. admin SELECT only.';

CREATE INDEX IF NOT EXISTS idx_activation_funnel_created_at
  ON public.activation_funnel_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activation_funnel_event_created
  ON public.activation_funnel_logs (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activation_funnel_bucket_event_created
  ON public.activation_funnel_logs (experiment_bucket, event_name, created_at DESC);

-- 중복 방지: user_id 기준 1회 / session 기준 1회
CREATE UNIQUE INDEX IF NOT EXISTS uq_activation_funnel_user_event
  ON public.activation_funnel_logs (user_id, event_name)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activation_funnel_session_event
  ON public.activation_funnel_logs (session_id, event_name)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.activation_funnel_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert activation funnel logs" ON public.activation_funnel_logs;
CREATE POLICY "Insert activation funnel logs" ON public.activation_funnel_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (
      auth.uid() IS NULL
      AND user_id IS NULL
      AND session_id IS NOT NULL
    )
    OR
    (
      auth.uid() IS NOT NULL
      AND (user_id IS NULL OR user_id = auth.uid())
      AND session_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins can view all activation funnel logs" ON public.activation_funnel_logs;
CREATE POLICY "Admins can view all activation funnel logs" ON public.activation_funnel_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

GRANT INSERT ON TABLE public.activation_funnel_logs TO anon, authenticated;

