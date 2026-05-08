-- '서문객잔' 장소의 place_id 확인
SELECT 
  id, 
  name, 
  place_id,
  lat,
  lng,
  created_at
FROM places 
WHERE name = '서문객잔';

-- place_id 컬럼이 있는지 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'places' 
ORDER BY ordinal_position;
