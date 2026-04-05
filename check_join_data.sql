-- curator_places와 places 조인 데이터 확인
SELECT 
  cp.id as curator_place_id,
  cp.place_id as curator_places_place_id,
  p.id as places_id,
  p.name,
  p.place_id as kakao_place_id,
  CASE 
    WHEN p.place_id IS NOT NULL THEN '✅ 카카오 ID 있음'
    ELSE '❌ 카카오 ID 없음'
  END as kakao_status
FROM curator_places cp
JOIN places p ON cp.place_id = p.id
WHERE cp.is_archived = false
  AND p.name = '서문객잔'
LIMIT 5;

-- places 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'places' 
  AND column_name IN ('id', 'place_id', 'name', 'lat', 'lng')
ORDER BY ordinal_position;
