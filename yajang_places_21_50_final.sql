-- 야장마스터 장소 데이터 import (21-50번) - 최종 버전
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 21. 충무로 대원식당 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충무로 대원식당 야장', '', 34.95010189963333, 127.49017155220966, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충무로 대원식당 야장');

-- 22. 성수동 바이산 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성수동 바이산 루프탑', '', 37.5515777517149, 127.11099014666, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성수동 바이산 루프탑');

-- 23. 성북동 조셉의 커피나무
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북동 조셉의 커피나무', '', 37.583686283060246, 127.1361762852497, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북동 조셉의 커피나무');

-- 24. 필동 한국의집 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '필동 한국의집 테라스', '', 37.5587, 126.9937, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '필동 한국의집 테라스');

-- 25. 충정로 철길떡볶이
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충정로 철길떡볶이', '', 37.5605, 126.9642, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충정로 철길떡볶이');

-- 26. 동묘 동묘마케트 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동묘 동묘마케트 테라스', '', 37.5735, 127.0162, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동묘 동묘마케트 테라스');

-- 27. 불광천 해담는다리 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '불광천 해담는다리 야장', '', 37.5872, 126.9085, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '불광천 해담는다리 야장');

-- 28. 당산역 선유기지 루프탑 (좌표 수동 설정)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '당산역 선유기지 루프탑', '', 37.5352, 126.8992, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '당산역 선유기지 루프탑');

-- 29. 대학로 독일주택 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '대학로 독일주택 테라스', '', 37.5822, 127.0001, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대학로 독일주택 테라스');

-- 30. 마곡 사이언스파크 광장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '마곡 사이언스파크 광장', '', 37.5617, 126.8335, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마곡 사이언스파크 광장');

-- 31. 망원 한강공원 선상야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '망원 한강공원 선상야장', '', 37.5523, 126.8924, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '망원 한강공원 선상야장');

-- 32. 청량리 상생장 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '청량리 상생장 루프탑', '', 37.5801, 127.0452, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청량리 상생장 루프탑');

-- 33. 구의역 미가로 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '구의역 미가로 야장', '', 37.5369, 127.0863, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '구의역 미가로 야장');

-- 34. 성내천 야외 치킨 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성내천 야외 치킨 야장', '', 37.5147, 127.1352, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성내천 야외 치킨 야장');

-- 35. 다동 황소막창 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '다동 황소막창 야장', '', 37.5678, 126.9802, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '다동 황소막창 야장');

-- 36. 도산공원 인근 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '도산공원 인근 테라스', '', 37.5244, 127.0353, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '도산공원 인근 테라스');

-- 37. 염리동 소금길 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '염리동 소금길 루프탑', '', 37.5482, 126.9467, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '염리동 소금길 루프탑');

-- 38. 해방촌 신흥시장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '해방촌 신흥시장 야장', '', 37.5447, 126.9852, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '해방촌 신흥시장 야장');

-- 39. 뚝섬 한강공원 노천야장 (좌표 수동 설정)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '뚝섬 한강공원 노천야장', '', 37.5287, 127.0672, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '뚝섬 한강공원 노천야장');

-- 40. 종로3가 포차거리
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '종로3가 포차거리', '', 37.5704, 126.9922, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '종로3가 포차거리');

-- 41. 창동역 포차거리
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '창동역 포차거리', '', 37.6532, 127.0475, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '창동역 포차거리');

-- 42. 화곡본동시장 영양족발
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '화곡본동시장 영양족발', '', 37.5412, 126.8415, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '화곡본동시장 영양족발');

-- 43. 선릉역 상록수 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '선릉역 상록수 야장', '', 37.5042, 127.0482, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '선릉역 상록수 야장');

-- 44. 충무로 인현시장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충무로 인현시장 야장', '', 37.5632, 126.9952, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충무로 인현시장 야장');

-- 45. 방배카페골목 노천맥주
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '방배카페골목 노천맥주', '', 37.4922, 126.9882, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방배카페골목 노천맥주');

-- 46. 신당동 옥경이네 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신당동 옥경이네 야장', '', 37.5652, 127.0172, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신당동 옥경이네 야장');

-- 47. 서초동 악바리 야외석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서초동 악바리 야외석', '', 37.5002, 127.0262, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서초동 악바리 야외석');

-- 48. 삼성동 백억하누 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '삼성동 백억하누 테라스', '', 37.5092, 127.0562, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '삼성동 백억하누 테라스');

-- 49. 약수역 노가리슈퍼
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '약수역 노가리슈퍼', '', 37.5542, 127.0112, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '약수역 노가리슈퍼');

-- 50. 상수역 무대륙 마당
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '상수역 무대륙 마당', '', 37.5472, 126.9212, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '상수역 무대륙 마당');

-- 51. 삼각지 대구탕골목 야외석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '삼각지 대구탕골목 야외석', '', 37.5344, 126.9658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '삼각지 대구탕골목 야외석');

-- 52. 문래동 창작촌 펍 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '문래동 창작촌 펍 테라스', '', 37.5161, 126.8946, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '문래동 창작촌 펍 테라스');

-- 53. 광화문 미진 뒤 야외테이블
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '광화문 미진 뒤 야외테이블', '', 37.5717, 126.9765, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '광화문 미진 뒤 야외테이블');

-- 54. 북촌 계동길 노천 카페
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '북촌 계동길 노천 카페', '', 37.5846, 126.9839, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '북촌 계동길 노천 카페');

-- 55. 남산 와인바 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '남산 와인바 루프탑', '', 37.5584, 126.9809, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '남산 와인바 루프탑');

-- 56. 성수동 연무장길 테라스 펍
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성수동 연무장길 테라스 펍', '', 37.5448, 127.0656, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성수동 연무장길 테라스 펍');

-- 57. 공덕역 전골목 야외 평상
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '공덕역 전골목 야외 평상', '', 37.5559, 126.9547, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '공덕역 전골목 야외 평상');

-- 58. 연남동 연트럴파크 잔디밭 바
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '연남동 연트럴파크 잔디밭 바', '', 37.5568, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '연남동 연트럴파크 잔디밭 바');

-- 59. 양재천 카페거리 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '양재천 카페거리 테라스', '', 37.4706, 127.0342, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '양재천 카페거리 테라스');

-- 60. 압구정 도산마루 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '압구정 도산마루 테라스', '', 37.5278, 127.0257, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '압구정 도산마루 테라스');

-- 61. 수유역 옥상 포차
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '수유역 옥상 포차', '', 37.6268, 127.0326, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '수유역 옥상 포차');

-- 62. 서대문 독립문 영천시장 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서대문 독립문 영천시장 야장', '', 37.5748, 126.9589, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서대문 독립문 영천시장 야장');

-- 63. 망원동 한강공원 입구 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '망원동 한강공원 입구 야장', '', 37.5568, 126.9087, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '망원동 한강공원 입구 야장');

-- 64. 부암동 산모퉁이 근처 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '부암동 산모퉁이 근처 테라스', '', 37.5946, 126.9578, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '부암동 산모퉁이 근처 테라스');

-- 65. 상암 DMC 물빛광장 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '상암 DMC 물빛광장 테라스', '', 37.5809, 126.8947, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '상암 DMC 물빛광장 테라스');

-- 66. 영등포 타임스퀘어 루프탑 가든
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '영등포 타임스퀘어 루프탑 가든', '', 37.5134, 126.8969, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '영등포 타임스퀘어 루프탑 가든');

-- 67. 목동 파라곤 지하광장 야외
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '목동 파라곤 지하광장 야외', '', 37.5275, 126.8658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '목동 파라곤 지하광장 야외');

-- 68. 잠실새내역 포차골목
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '잠실새내역 포차골목', '', 37.5136, 127.0866, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '잠실새내역 포차골목');

-- 69. 사당역 수변공원 인근 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '사당역 수변공원 인근 테라스', '', 37.4766, 126.9512, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '사당역 수변공원 인근 테라스');

-- 70. 방이동 먹자골목 야외석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '방이동 먹자골목 야외석', '', 37.5147, 127.1352, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방이동 먹자골목 야외석');

-- Curator_Place 관계 추가 (21-50번)
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
  '약수역 노가리슈퍼', '상수역 무대륙 마당', '삼각지 대구탕골목 야외석', '문래동 창작촌 펍 테라스',
  '광화문 미진 뒤 야외테이블', '북촌 계동길 노천 카페', '남산 와인바 루프탑', '성수동 연무장길 테라스 펍',
  '공덕역 전골목 야외 평상', '연남동 연트럴파크 잔디밭 바', '양재천 카페거리 테라스', '압구정 도산마루 테라스',
  '수유역 옥상 포차', '서대문 독립문 영천시장 야장', '망원동 한강공원 입구 야장', '부암동 산모퉁이 근처 테라스',
  '상암 DMC 물빛광장 테라스', '영등포 타임스퀘어 루프탑 가든', '목동 파라곤 지하광장 야외', '잠실새내역 포차골목',
  '사당역 수변공원 인근 테라스', '방이동 먹자골목 야외석'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
