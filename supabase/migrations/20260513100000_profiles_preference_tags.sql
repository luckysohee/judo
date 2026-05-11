-- 취향 온보딩: 저장 전에도 태그 기반 추천 시그널을 줄 수 있도록 profiles 에 보관.
-- taste_onboarding_dismissed_at: 온보딩 완료 또는 건너뛰기 시각. NULL 이면 앱에서 아직 안내 가능.
-- 기존 사용자는 일괄 dismissed 처리해 재방문 시 모달이 뜨지 않게 한다.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preference_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS taste_onboarding_dismissed_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.preference_tags IS
  '온보딩 등에서 고른 취향 태그. 저장/좋아요 시그널이 없을 때 추천 fallback 용.';
COMMENT ON COLUMN public.profiles.taste_onboarding_dismissed_at IS
  '취향 온보딩을 저장했거나 건너뛴 시각. NULL 이면 신규·미완료로 간주 가능.';

UPDATE public.profiles
SET taste_onboarding_dismissed_at = COALESCE(
  taste_onboarding_dismissed_at,
  timezone('utc'::text, now())
)
WHERE taste_onboarding_dismissed_at IS NULL;

NOTIFY pgrst, 'reload schema';
