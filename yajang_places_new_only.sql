-- 야장마스터 장소 데이터 import (새로운 장소만)
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 중복 확인 후 새로운 장소만 INSERT
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충무로 대원식당 야장', '', 37.5615, 126.9935, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충무로 대원식당 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성수동 바이산 루프탑', '', 37.5408, 127.0545, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성수동 바이산 루프탑');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북동 조셉의 커피나무', '', 37.5932, 126.9958, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북동 조셉의 커피나무');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '필동 한국의집 테라스', '', 37.5587, 126.9937, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '필동 한국의집 테라스');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충정로 철길떡볶이', '', 37.5605, 126.9642, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충정로 철길떡볶이');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동묘 동묘마케트 테라스', '', 37.5735, 127.0162, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동묘 동묘마케트 테라스');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '불광천 해담는다리 야장', '', 37.5872, 126.9085, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '불광천 해담는다리 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '당산역 선유기지 루프탑', '', 37.5352, 126.8992, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '당산역 선유기지 루프탑');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '대학로 독일주택 테라스', '', 37.5822, 127.0001, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대학로 독일주택 테라스');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '마곡 사이언스파크 광장', '', 37.5617, 126.8335, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마곡 사이언스파크 광장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '망원 한강공원 선상야장', '', 37.5523, 126.8924, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '망원 한강공원 선상야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '청량리 상생장 루프탑', '', 37.5801, 127.0452, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청량리 상생장 루프탑');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '구의역 미가로 야장', '', 37.5369, 127.0863, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '구의역 미가로 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성내천 야외 치킨 야장', '', 37.5147, 127.1352, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성내천 야외 치킨 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '다동 황소막창 야장', '', 37.5678, 126.9802, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '다동 황소막창 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '도산공원 인근 테라스', '', 37.5244, 127.0353, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '도산공원 인근 테라스');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '염리동 소금길 루프탑', '', 37.5482, 126.9467, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '염리동 소금길 루프탑');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '해방촌 신흥시장 야장', '', 37.5447, 126.9852, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '해방촌 신흥시장 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '뚝섬 한강공원 노천야장', '', 37.5287, 127.0672, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '뚝섬 한강공원 노천야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '종로3가 포차거리', '', 37.5704, 126.9922, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '종로3가 포차거리');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '창동역 포차거리', '', 37.6532, 127.0475, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '창동역 포차거리');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '화곡본동시장 영양족발', '', 37.5412, 126.8415, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '화곡본동시장 영양족발');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '선릉역 상록수 야장', '', 37.5042, 127.0482, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '선릉역 상록수 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충무로 인현시장 야장', '', 37.5632, 126.9952, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충무로 인현시장 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '방배카페골목 노천맥주', '', 37.4922, 126.9882, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방배카페골목 노천맥주');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신당동 옥경이네 야장', '', 37.5652, 127.0172, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신당동 옥경이네 야장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서초동 악바리 야외석', '', 37.5002, 127.0262, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서초동 악바리 야외석');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '삼성동 백억하누 테라스', '', 37.5092, 127.0562, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '삼성동 백억하누 테라스');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '약수역 노가리슈퍼', '', 37.5542, 127.0112, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '약수역 노가리슈퍼');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '상수역 무대륙 마당', '', 37.5472, 126.9212, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '상수역 무대륙 마당');

-- Curator_Place 관계 추가 (새로운 장소만)
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at) 
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW() 
FROM places 
WHERE name IN (
  '충무로 대원식당 야장', '성수동 바이산 루프탑', '성북동 조셉의 커피나무', '필동 한국의집 테라스',
  '충정로 철길떡볶이', '동묘 동묘마케트 테라스', '불광천 해담는다리 야장', '당산역 선유기지 루프탑',
  '대학로 독일주택 테라스', '마곡 사이언스파크 광장', '망원 한강공원 선상야장', '청량리 상생장 루프탑',
  '구의역 미가로 야장', '성내천 야외 치킨 야장', '다동 황소막창 야장', '도산공원 인근 테라스',
  '염리동 소금길 루프탑', '해방촌 신흥시장 야장', '뚝섬 한강공원 노천야장', '종로3가 포차거리',
  '창동역 포차거리', '화곡본동시장 영양족발', '선릉역 상록수 야장', '충무로 인현시장 야장',
  '방배카페골목 노천맥주', '신당동 옥경이네 야장', '서초동 악바리 야외석', '삼성동 백억하누 테라스',
  '약수역 노가리슈퍼', '상수역 무대륙 마당'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
