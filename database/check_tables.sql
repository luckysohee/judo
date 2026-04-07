-- 테이블 존재 여부 확인
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name IN ('search_logs', 'place_click_logs')
ORDER BY table_name;

-- 테이블 컬럼 정보 확인 (search_logs)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'search_logs'
ORDER BY ordinal_position;

-- 테이블 컬럼 정보 확인 (place_click_logs)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'place_click_logs'
ORDER BY ordinal_position;

-- 테이블 샘플 데이터 확인 (있는 경우)
SELECT 'search_logs' as table_name, COUNT(*) as row_count FROM search_logs
UNION ALL
SELECT 'place_click_logs' as table_name, COUNT(*) as row_count FROM place_click_logs;
