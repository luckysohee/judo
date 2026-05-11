-- 홈·프로필 등 컬렉션 UI 클릭/공유 성공 로그 (검색 CTR용 place_click_logs 와 분리)
CREATE TABLE IF NOT EXISTS public.collection_interaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  source_section TEXT NOT NULL,
  collection_id UUID NOT NULL REFERENCES public.collections (id) ON DELETE CASCADE,
  clicked_rank INTEGER,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.collection_interaction_logs IS
  '컬렉션 카드 클릭·상세 공유 성공 등 경량 이벤트. 클라이언트 INSERT만 허용.';

CREATE INDEX IF NOT EXISTS idx_collection_interaction_logs_created_at
  ON public.collection_interaction_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_interaction_logs_section_created
  ON public.collection_interaction_logs (source_section, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_interaction_logs_collection_created
  ON public.collection_interaction_logs (collection_id, created_at DESC);

ALTER TABLE public.collection_interaction_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert collection interaction logs" ON public.collection_interaction_logs;
CREATE POLICY "Insert collection interaction logs" ON public.collection_interaction_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can view all collection interaction logs" ON public.collection_interaction_logs;
CREATE POLICY "Admins can view all collection interaction logs" ON public.collection_interaction_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

GRANT INSERT ON TABLE public.collection_interaction_logs TO anon, authenticated;
