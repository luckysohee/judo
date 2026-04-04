-- 중복 상호명 확인 및 처리 SQL

-- 현재 places 테이블의 중복 상호명 확인
SELECT name, COUNT(*) as count 
FROM places 
GROUP BY name 
HAVING COUNT(*) > 1 
ORDER BY count DESC;

-- curator_places 테이블에 연결되지 않은 장소들 확인
SELECT p.name, p.id 
FROM places p 
LEFT JOIN curator_places cp ON p.id = cp.place_id 
WHERE cp.place_id IS NULL;

-- 현재 총 장소 수 확인
SELECT COUNT(*) as total_places FROM places;

-- 현재 연결된 curator_places 수 확인
SELECT COUNT(*) as total_curator_places FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c';
