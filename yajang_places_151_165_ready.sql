-- 야장마스터 장소 데이터 import (151-165번) - 바로 복붙용
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 151. 송파구 가락시장역 노천 술집
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '송파구 가락시장역 노천 술집', '', 37.5147, 127.1352, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '송파구 가락시장역 노천 술집');

-- 152. 강남구 논현동 영동시장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강남구 논현동 영동시장 야장', '', 37.5278, 127.0257, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강남구 논현동 영동시장 야장');

-- 153. 마포구 상암동 먹자골목 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '마포구 상암동 먹자골목 야장', '', 37.5809, 126.8947, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마포구 상암동 먹자골목 야장');

-- 154. 관악구 낙성대역 골목 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '관악구 낙성대역 골목 테라스', '', 37.4766, 126.9512, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '관악구 낙성대역 골목 테라스');

-- 155. 광진구 구의동 아차산역 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '광진구 구의동 아차산역 야장', '', 37.5369, 127.0863, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '광진구 구의동 아차산역 야장');

-- 156. 은평구 연신내 로데오 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '은평구 연신내 로데오 야장', '', 37.5872, 126.9085, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '은평구 연신내 로데오 야장');

-- 157. 영등포구 당산역 루프탑 와인바
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '영등포구 당산역 루프탑 와인바', '', 37.5352, 126.8992, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '영등포구 당산역 루프탑 와인바');

-- 158. 성북구 돈암동 성신여대 앞 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북구 돈암동 성신여대 앞 야장', '', 37.5946, 126.9578, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북구 돈암동 성신여대 앞 야장');

-- 159. 양천구 신정동 법원 앞 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '양천구 신정동 법원 앞 테라스', '', 37.5275, 126.8658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '양천구 신정동 법원 앞 테라스');

-- 160. 서대문구 북가좌동 증산역 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서대문구 북가좌동 증산역 야장', '', 37.5748, 126.9589, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서대문구 북가좌동 증산역 야장');

-- 161. 종로구 평창동 산자락 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '종로구 평창동 산자락 테라스', '', 37.5717, 126.9765, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '종로구 평창동 산자락 테라스');

-- 162. 강서구 화곡역 시장 골목 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강서구 화곡역 시장 골목 야장', '', 37.5412, 126.8415, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강서구 화곡역 시장 골목 야장');

-- 163. 강동구 성내동 올림픽공원 뷰 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강동구 성내동 올림픽공원 뷰 테라스', '', 37.5147, 127.1352, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강동구 성내동 올림픽공원 뷰 테라스');

-- 164. 노원구 공릉동 도깨비시장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '노원구 공릉동 도깨비시장 야장', '', 37.6268, 127.0326, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '노원구 공릉동 도깨비시장 야장');

-- 165. 중구 필동 한옥마을 인근 야외석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '중구 필동 한옥마을 인근 야외석', '', 37.5632, 126.9952, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '중구 필동 한옥마을 인근 야외석');

-- Curator_Place 관계 추가 (151-165번)
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '송파구 가락시장역 노천 술집', '강남구 논현동 영동시장 야장', '마포구 상암동 먹자골목 야장', '관악구 낙성대역 골목 테라스',
  '광진구 구의동 아차산역 야장', '은평구 연신내 로데오 야장', '영등포구 당산역 루프탑 와인바', '성북구 돈암동 성신여대 앞 야장',
  '양천구 신정동 법원 앞 테라스', '서대문구 북가좌동 증산역 야장', '종로구 평창동 산자락 테라스', '강서구 화곡역 시장 골목 야장',
  '강동구 성내동 올림픽공원 뷰 테라스', '노원구 공릉동 도깨비시장 야장', '중구 필동 한옥마을 인근 야외석'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
