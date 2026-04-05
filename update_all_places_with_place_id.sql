-- 모든 장소에 place_id 추가 (curator_places_with_place_id.sql 기준)

-- 마당족발
UPDATE places SET place_id = '7866034' WHERE name = '마당족발' AND place_id IS NULL;

-- 리제로 서울  
UPDATE places SET place_id = '1398571605' WHERE name = '리제로 서울' AND place_id IS NULL;

-- 르스타일바
UPDATE places SET place_id = '27072801' WHERE name = '르스타일바' AND place_id IS NULL;

-- 루프탑스테이
UPDATE places SET place_id = '1369127798' WHERE name = '루프탑스테이' AND place_id IS NULL;

-- 루프탑 피자펍
UPDATE places SET place_id = '1872752229' WHERE name = '루프탑 피자펍' AND place_id IS NULL;

-- 루프탑어반비치
UPDATE places SET place_id = '1424950736' WHERE name = '루프탑어반비치' AND place_id IS NULL;

-- 루프808
UPDATE places SET place_id = '561053021' WHERE name = '루프808' AND place_id IS NULL;

-- 랜돌프비어 마곡나루
UPDATE places SET place_id = '1272392964' WHERE name = '랜돌프비어 마곡나루' AND place_id IS NULL;

-- 디자이너리카페
UPDATE places SET place_id = '1099251112' WHERE name = '디자이너리카페' AND place_id IS NULL;

-- 동해남부선 서촌본점
UPDATE places SET place_id = '21056157' WHERE name = '동해남부선 서촌본점' AND place_id IS NULL;

-- 확인
SELECT 
  name, 
  place_id,
  CASE 
    WHEN place_id IS NOT NULL THEN '✅ 있음'
    ELSE '❌ 없음'
  END as status
FROM places 
WHERE name IN ('마당족발', '리제로 서울', '르스타일바', '루프탑스테이', '루프탑 피자펍')
ORDER BY name;
