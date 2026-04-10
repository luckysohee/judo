-- UserCard / 지도 프로필: 핸들(username)·닉네임(display_name).
-- 컬럼이 없으면 PostgREST가 select·filter·patch 시 400을 반환할 수 있음.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

COMMENT ON COLUMN public.profiles.username IS
  '앱 전용 핸들(@ 없이, 소문자 영숫자·언더스코어).';
COMMENT ON COLUMN public.profiles.display_name IS
  '다른 사용자에게 보이는 닉네임.';

NOTIFY pgrst, 'reload schema';
