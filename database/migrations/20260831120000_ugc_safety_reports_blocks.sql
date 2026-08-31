-- App Store Guideline 1.2: UGC 신고·차단·약관 동의·운영 모더레이션

-- ---------------------------------------------------------------------------
-- 콘텐츠 신고
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL
    CHECK (target_type IN (
      'course',
      'place',
      'curator_place',
      'profile',
      'user',
      'photo',
      'pick',
      'checkin',
      'other'
    )),
  target_id text NOT NULL,
  target_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL
    CHECK (reason IN (
      'spam',
      'harassment',
      'hate',
      'sexual',
      'misinfo',
      'illegal',
      'other'
    )),
  detail text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
  ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_reporter_idx
  ON public.content_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports (target_type, target_id);

COMMENT ON TABLE public.content_reports IS
  'UGC 신고 큐. 운영자가 24시간 내 검토·조치하는 것을 목표로 합니다.';

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_reports_insert_own ON public.content_reports;
CREATE POLICY content_reports_insert_own
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS content_reports_select_own_or_admin ON public.content_reports;
CREATE POLICY content_reports_select_own_or_admin
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS content_reports_update_admin ON public.content_reports;
CREATE POLICY content_reports_update_admin
  ON public.content_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 사용자 차단
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
  ON public.user_blocks (blocked_id);

COMMENT ON TABLE public.user_blocks IS
  '이용자 간 차단. 차단한 사용자의 UGC·프로필이 차단자에게 노출되지 않도록 앱에서 필터합니다.';

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own
  ON public.user_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own
  ON public.user_blocks
  FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 약관 동의 기록 (profiles)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS '이용약관 동의 시각';
COMMENT ON COLUMN public.profiles.terms_version IS '동의한 약관 버전 식별자';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS '개인정보 처리방침 동의 시각(선택)';
