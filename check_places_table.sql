-- places 테이블 구조 확인
\d places;

-- place_id가 있는 데이터 확인
SELECT 
  id, 
  name, 
  place_id,
  lat,
  lng,
  created_at
FROM places 
WHERE place_id IS NOT NULL
ORDER BY created_at DESC 
LIMIT 10;

-- place_id 통계
SELECT 
  COUNT(*) as total_places,
  COUNT(place_id) as places_with_place_id,
  COUNT(*) - COUNT(place_id) as places_without_place_id
FROM places;
