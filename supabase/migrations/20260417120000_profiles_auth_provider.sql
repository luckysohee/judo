ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_provider text,
  ADD COLUMN IF NOT EXISTS auth_provider_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.auth_provider IS
  '마지막 OAuth/로그인 제공자(kakao, google, email 등). 공개 프로필 @핸들과 별개.';
