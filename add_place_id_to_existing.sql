-- 1. place_id 컬럼 추가
ALTER TABLE places ADD COLUMN IF NOT EXISTS place_id VARCHAR(50);

-- 2. '서문객잔'에 place_id 추가 (카카오 검색 결과)
UPDATE places 
SET place_id = '1720697728' 
WHERE name = '서문객잔' AND place_id IS NULL;

-- 3. 다른 장소들도 place_id 추가 (curator_places_with_place_id.sql에서 가져온 ID들)
UPDATE places SET place_id = '812076679' WHERE name = '만리199' AND place_id IS NULL;
UPDATE places SET place_id = '1975224967' WHERE name = 'L7 강남 플로팅바' AND place_id IS NULL;
UPDATE places SET place_id = '1594335650' WHERE name = '히든아워' AND place_id IS NULL;
UPDATE places SET place_id = '26441783' WHERE name = '효자바베' AND place_id IS NULL;
UPDATE places SET place_id = '1303797211' WHERE name = '황소막창소금구이닭발' AND place_id IS NULL;

-- 4. 확인
SELECT 
  id, 
  name, 
  place_id,
  CASE 
    WHEN place_id IS NOT NULL THEN '✅ 있음'
    ELSE '❌ 없음'
  END as status
FROM places 
WHERE name IN ('서문객잔', '만리199', '히든아워')
ORDER BY created_at DESC;
