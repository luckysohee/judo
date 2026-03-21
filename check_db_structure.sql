-- places 테이블 구조 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'places' 
ORDER BY ordinal_position;

-- places 테이블 샘플 데이터 확인
SELECT id, name, lat, lng, created_at, user_id, curator_id
FROM places 
ORDER BY created_at DESC 
LIMIT 5;

-- curators 테이블 구조 확인  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'curators'
ORDER BY ordinal_position;

-- curators 테이블 샘플 데이터 확인
SELECT id, username, display_name, user_id
FROM curators 
ORDER BY created_at DESC 
LIMIT 5;
