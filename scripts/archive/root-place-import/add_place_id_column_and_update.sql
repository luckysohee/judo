-- 1. places 테이블에 place_id 컬럼 추가 (없을 경우)
ALTER TABLE places ADD COLUMN IF NOT EXISTS place_id VARCHAR(50);

-- 2. 기존 데이터에 place_id 업데이트 (카카오 ID로)
-- 이 부분은 수동으로 업데이트하거나, curator_places_from_names.sql 실행

-- 3. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_places_place_id ON places(place_id);

-- 4. place_id가 있는 데이터 확인
SELECT 
  id, 
  name, 
  place_id,
  CASE 
    WHEN place_id IS NOT NULL THEN '✅ place_id 있음'
    ELSE '❌ place_id 없음'
  END as place_id_status
FROM places 
ORDER BY created_at DESC 
LIMIT 10;
