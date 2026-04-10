-- "permission denied for table profiles" → 컬럼 부재가 아니라 역할에 테이블 권한(GRANT)이 없을 때 흔함.
-- PostgREST는 anon / authenticated 역할로 접속하므로 최소 권한을 명시한다.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- 비로그인 공개 조회가 필요하면 주석 해제
-- GRANT SELECT ON TABLE public.profiles TO anon;
