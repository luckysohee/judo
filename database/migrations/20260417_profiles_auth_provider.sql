-- 로그인 경로 기록(내부용). 공개 @핸들·닉네임과 UI에서 구분해 표시.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_provider text,
  ADD COLUMN IF NOT EXISTS auth_provider_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.auth_provider IS
  '마지막 OAuth/로그인 제공자(kakao, google, email 등). 카카오/구글 계정 표시와 별개.';

COMMENT ON COLUMN public.profiles.auth_provider_updated_at IS
  'auth_provider 가 마지막으로 갱신된 시각';
