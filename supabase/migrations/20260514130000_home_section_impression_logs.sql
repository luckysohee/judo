-- Home 주요 섹션 노출(impression) 로그: IntersectionObserver 기반 1회 기록.
-- collection_interaction_logs 와 분리해 가벼운 운영 관측 지표로 사용.

CREATE TABLE IF NOT EXISTS public.home_section_impression_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  logged_in BOOLEAN NOT NULL DEFAULT false,
  followed_only BOOLEAN NOT NULL DEFAULT false,
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.home_section_impression_logs IS
  '홈 섹션(레일) 노출 이벤트. 클라이언트 INSERT만 허용. Admin만 전체 SELECT.';

CREATE INDEX IF NOT EXISTS idx_home_section_impr_created_at
  ON public.home_section_impression_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_home_section_impr_section_created
  ON public.home_section_impression_logs (section_name, created_at DESC);

ALTER TABLE public.home_section_impression_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert home section impression logs" ON public.home_section_impression_logs;
CREATE POLICY "Insert home section impression logs" ON public.home_section_impression_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can view all home section impression logs" ON public.home_section_impression_logs;
CREATE POLICY "Admins can view all home section impression logs" ON public.home_section_impression_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

GRANT INSERT ON TABLE public.home_section_impression_logs TO anon, authenticated;

