-- permission denied for table profiles: GRANT 부족(컬럼 누락과는 다른 오류)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
