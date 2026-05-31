-- RLS 문제 해결 SQL

-- 1. 현재 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'places';

-- 2. 임시로 RLS 비활성화 (가장 빠른 해결책)
ALTER TABLE places DISABLE ROW LEVEL SECURITY;

-- 3. 또는 모든 사용자에게 권한 부여
CREATE POLICY "Enable all operations" ON places
FOR ALL USING (true) WITH CHECK (true);

-- 4. 테이블 권한 확인
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'places';
