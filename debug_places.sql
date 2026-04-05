-- 1. places 테이블에 place_id 컬럼이 있는지 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'places' AND column_name = 'place_id';

-- 2. place_id가 있는 데이터 확인
SELECT 
  id, 
  name, 
  place_id,
  CASE 
    WHEN place_id IS NOT NULL THEN '✅ 있음'
    ELSE '❌ 없음'
  END as status
FROM places 
ORDER BY created_at DESC 
LIMIT 20;

-- 3. curator_places와 조인된 데이터 확인
SELECT 
  cp.id as curator_place_id,
  cp.curator_id,
  p.id as place_id,
  p.name,
  p.place_id as kakao_place_id,
  CASE 
    WHEN p.place_id IS NOT NULL THEN '✅ 있음'
    ELSE '❌ 없음'
  END as status
FROM curator_places cp
JOIN places p ON cp.place_id = p.id
WHERE cp.is_archived = false
ORDER BY cp.created_at DESC
LIMIT 10;
