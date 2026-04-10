-- 팔로워 목록·공개 프로필용 얼굴 사진 URL (OAuth picture 등)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.avatar_url IS
  '공개 프로필 사진 URL. 로그인 메타(구글 picture 등)에서 시드 가능.';

NOTIFY pgrst, 'reload schema';
