-- 실제 places 테이블 구조 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'places' 
ORDER BY ordinal_position;

-- curator_places 테이블 구조 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'curator_places' 
ORDER BY ordinal_position;
