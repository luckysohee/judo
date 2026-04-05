-- DB에 place_id가 있는지 확인하는 쿼리
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

-- place_id가 있는 장소 개수 확인
SELECT 
  COUNT(*) as total_places,
  COUNT(place_id) as places_with_place_id,
  COUNT(*) - COUNT(place_id) as places_without_place_id
FROM places;
