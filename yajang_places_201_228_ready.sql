-- 야장마스터 장소 데이터 import (201-228번) - 바로 복붙용
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 201. 강동구 암사동 한강변 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강동구 암사동 한강변 테라스', '', 37.5147, 127.1352, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강동구 암사동 한강변 테라스');

-- 202. 성북구 삼선교 성북천 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북구 삼선교 성북천 야장', '', 37.5946, 126.9578, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북구 삼선교 성북천 야장');

-- 203. 용산구 한강로 기찻길 옆 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '용산구 한강로 기찻길 옆 야장', '', 37.5344, 126.9658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '용산구 한강로 기찻길 옆 야장');

-- 204. 중구 명동 루프탑 가든
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '중구 명동 루프탑 가든', '', 37.5717, 126.9765, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '중구 명동 루프탑 가든');

-- 205. 광진구 자양동 뚝섬유원지 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '광진구 자양동 뚝섬유원지 테라스', '', 37.5369, 127.0863, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '광진구 자양동 뚝섬유원지 테라스');

-- 206. 서대문구 창천동 신촌 굴다리 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서대문구 창천동 신촌 굴다리 야장', '', 37.5559, 126.9547, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서대문구 창천동 신촌 굴다리 야장');

-- 207. 영등포구 당산역 한강 연결통로 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '영등포구 당산역 한강 연결통로 야장', '', 37.5352, 126.8992, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '영등포구 당산역 한강 연결통로 야장');

-- 208. 성동구 마장동 우시장 야외 골목
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성동구 마장동 우시장 야외 골목', '', 37.5724, 126.9896, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성동구 마장동 우시장 야외 골목');

-- 209. 동작구 상도동 밤골마을 입구 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동작구 상도동 밤골마을 입구 테라스', '', 37.4766, 126.9512, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동작구 상도동 밤골마을 입구 테라스');

-- 210. 송파구 오금동 성내천 물빛광장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '송파구 오금동 성내천 물빛광장 야장', '', 37.5147, 127.1352, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '송파구 오금동 성내천 물빛광장 야장');

-- 211. 마포구 아현동 가구거리 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '마포구 아현동 가구거리 테라스', '', 37.5568, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마포구 아현동 가구거리 테라스');

-- 212. 은평구 응암동 대림시장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '은평구 응암동 대림시장 야장', '', 37.5872, 126.9085, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '은평구 응암동 대림시장 야장');

-- 213. 서초구 잠원 한강공원 선상 바
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서초구 잠원 한강공원 선상 바', '', 37.5144, 126.9926, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서초구 잠원 한강공원 선상 바');

-- 214. 강남구 신사동 도산대로 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강남구 신사동 도산대로 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강남구 신사동 도산대로 루프탑');

-- 215. 관악구 남현동 관악산 입구 야외석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '관악구 남현동 관악산 입구 야외석', '', 37.4766, 126.9512, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '관악구 남현동 관악산 입구 야외석');

-- 216. 강서구 마곡나루 중앙광장 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강서구 마곡나루 중앙광장 테라스', '', 37.5617, 126.8335, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강서구 마곡나루 중앙광장 테라스');

-- 217. 노원구 하계동 중계근린공원 인근 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '노원구 하계동 중계근린공원 인근 야장', '', 37.6268, 127.0326, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '노원구 하계동 중계근린공원 인근 야장');

-- 218. 종로구 창신동 절벽마을 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '종로구 창신동 절벽마을 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '종로구 창신동 절벽마을 루프탑');

-- 219. 중랑구 면목동 동부시장 골목 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '중랑구 면목동 동부시장 골목 야장', '', 37.5724, 126.9896, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '중랑구 면목동 동부시장 골목 야장');

-- 220. 강북구 미아동 북서울꿈의숲 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강북구 미아동 북서울꿈의숲 테라스', '', 37.5946, 126.9578, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강북구 미아동 북서울꿈의숲 테라스');

-- 221. 용산구 갈월동 남영역 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '용산구 갈월동 남영역 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '용산구 갈월동 남영역 루프탑');

-- 222. 도봉구 도봉산 입구 야외 평상
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '도봉구 도봉산 입구 야외 평상', '', 37.6268, 127.0326, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '도봉구 도봉산 입구 야외 평상');

-- 223. 양천구 신정동 서부트럭터미널 인근 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '양천구 신정동 서부트럭터미널 인근 야장', '', 37.5275, 126.8658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '양천구 신정동 서부트럭터미널 인근 야장');

-- 224. 강서구 방화동 정곡공원 뒤 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강서구 방화동 정곡공원 뒤 테라스', '', 37.5412, 126.8415, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강서구 방화동 정곡공원 뒤 테라스');

-- 225. 구로구 신도림역 디큐브 광장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '구로구 신도림역 디큐브 광장 야장', '', 37.5134, 126.8969, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '구로구 신도림역 디큐브 광장 야장');

-- 226. 금천구 독산동 우시장 뒤 야외석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '금천구 독산동 우시장 뒤 야외석', '', 37.4766, 126.9512, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '금천구 독산동 우시장 뒤 야외석');

-- 227. 동대문구 청량리 경동시장 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동대문구 청량리 경동시장 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동대문구 청량리 경동시장 루프탑');

-- 228. 성북구 안암동 개운산 입구 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북구 안암동 개운산 입구 테라스', '', 37.5946, 126.9578, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북구 안암동 개운산 입구 테라스');

-- Curator_Place 관계 추가 (201-228번)
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '강동구 암사동 한강변 테라스', '성북구 삼선교 성북천 야장', '용산구 한강로 기찻길 옆 야장', '중구 명동 루프탑 가든',
  '광진구 자양동 뚝섬유원지 테라스', '서대문구 창천동 신촌 굴다리 야장', '영등포구 당산역 한강 연결통로 야장', '성동구 마장동 우시장 야외 골목',
  '동작구 상도동 밤골마을 입구 테라스', '송파구 오금동 성내천 물빛광장 야장', '마포구 아현동 가구거리 테라스', '은평구 응암동 대림시장 야장',
  '서초구 잠원 한강공원 선상 바', '강남구 신사동 도산대로 루프탑', '관악구 남현동 관악산 입구 야외석', '강서구 마곡나루 중앙광장 테라스',
  '노원구 하계동 중계근린공원 인근 야장', '종로구 창신동 절벽마을 루프탑', '중랑구 면목동 동부시장 골목 야장', '강북구 미아동 북서울꿈의숲 테라스',
  '용산구 갈월동 남영역 루프탑', '도봉구 도봉산 입구 야외 평상', '양천구 신정동 서부트럭터미널 인근 야장', '강서구 방화동 정곡공원 뒤 테라스',
  '구로구 신도림역 디큐브 광장 야장', '금천구 독산동 우시장 뒤 야외석', '동대문구 청량리 경동시장 루프탑', '성북구 안암동 개운산 입구 테라스'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
