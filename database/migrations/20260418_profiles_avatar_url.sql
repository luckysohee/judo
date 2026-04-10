ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.profiles.avatar_url IS
  '공개 프로필 사진 URL (OAuth picture 등).';

NOTIFY pgrst, 'reload schema';
