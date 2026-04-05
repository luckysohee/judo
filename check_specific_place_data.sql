-- '더백테라스 신용산점'의 place_id 확인
SELECT 
  p.id,
  p.name,
  p.place_id,
  p.lat,
  p.lng,
  p.category,
  cp.id as curator_place_id,
  cp.curator_id
FROM places p
JOIN curator_places cp ON p.id = cp.place_id
WHERE p.name = '더백테라스 신용산점'
  AND cp.is_archived = false;

-- places 테이블에서 place_id가 있는 모든 장소 확인
SELECT 
  name,
  place_id,
  CASE 
    WHEN place_id IS NOT NULL THEN '✅ 있음'
    ELSE '❌ 없음'
  END as status
FROM places 
WHERE place_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
