-- 야장마스터 장소 데이터 import (51-70번) - 바로 복붙용
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 51. 회현동 남산순환로 입구 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '회현동 남산순환로 입구 테라스', '', 37.5567, 126.9658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '회현동 남산순환로 입구 테라스');

-- 52. 동교동 와우산로 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동교동 와우산로 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동교동 와우산로 루프탑');

-- 53. 안국동 수표교 인근 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '안국동 수표교 인근 야장', '', 37.5724, 126.9896, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '안국동 수표교 인근 야장');

-- 54. 대치동 학원가 뒤 정원 펍
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '대치동 학원가 뒤 정원 펍', '', 37.6268, 127.0326, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대치동 학원가 뒤 정원 펍');

-- 55. 반포동 서래마을 노천 카페
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '반포동 서래마을 노천 카페', '', 37.5118, 126.9755, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '반포동 서래마을 노천 카페');

-- 56. 신림동 도림천 수변 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신림동 도림천 수변 야장', '', 37.5724, 126.9896, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신림동 도림천 수변 야장');

-- 57. 이태원 경리단길 중턱 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '이태원 경리단길 중턱 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이태원 경리단길 중턱 루프탑');

-- 58. 청담동 가로수 아래 테라스 바
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '청담동 가로수 아래 테라스 바', '', 37.5144, 126.9926, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청담동 가로수 아래 테라스 바');

-- 59. 성북동 한옥 마당 탭하우스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북동 한옥 마당 탭하우스', '', 37.5837, 127.0112, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북동 한옥 마당 탭하우스');

-- 60. 공덕역 경의선 숲길 끝 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '공덕역 경의선 숲길 끝 테라스', '', 37.5559, 126.9547, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '공덕역 경의선 숲길 끝 테라스');

-- 61. 왕십리 곱창거리 야외석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '왕십리 곱창거리 야외석', '', 37.5748, 126.9589, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '왕십리 곱창거리 야외석');

-- 62. 금호동 언덕 위 야외 와인바
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '금호동 언덕 위 야외 와인바', '', 37.5184, 127.0180, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '금호동 언덕 위 야외 와인바');

-- 63. 충무로 필동 골목 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충무로 필동 골목 야장', '', 37.5632, 126.9952, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충무로 필동 골목 야장');

-- 64. 신사동 세로수길 루프탑 펍
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신사동 세로수길 루프탑 펍', '', 37.5178, 127.0204, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신사동 세로수길 루프탑 펍');

-- 65. 여의도 한강공원 배달존 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '여의도 한강공원 배달존 야장', '', 37.5251, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '여의도 한강공원 배달존 야장');

-- 66. 홍대 땡땡거리 야외 치킨집
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '홍대 땡땡거리 야외 치킨집', '', 37.5568, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '홍대 땡땡거리 야외 치킨집');

-- 67. 연희동 주택 개조 와인바 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '연희동 주택 개조 와인바 테라스', '', 37.5568, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '연희동 주택 개조 와인바 테라스');

-- 68. 동대문 DDP 근처 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동대문 DDP 근처 루프탑', '', 37.5614, 127.0069, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동대문 DDP 근처 루프탑');

-- 69. 성북천 산책로 야외 테이블
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북천 산책로 야외 테이블', '', 37.5798, 126.9654, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북천 산책로 야외 테이블');

-- 70. 신촌 연세로 야외 테라스 펍
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신촌 연세로 야외 테라스 펍', '', 37.5568, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신촌 연세로 야외 테라스 펍');

-- Curator_Place 관계 추가 (51-70번)
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '회현동 남산순환로 입구 테라스', '동교동 와우산로 루프탑', '안국동 수표교 인근 야장', '대치동 학원가 뒤 정원 펍',
  '반포동 서래마을 노천 카페', '신림동 도림천 수변 야장', '이태원 경리단길 중턱 루프탑', '청담동 가로수 아래 테라스 바',
  '성북동 한옥 마당 탭하우스', '공덕역 경의선 숲길 끝 테라스', '왕십리 곱창거리 야외석', '금호동 언덕 위 야외 와인바',
  '충무로 필동 골목 야장', '신사동 세로수길 루프탑 펍', '여의도 한강공원 배달존 야장', '홍대 땡땡거리 야외 치킨집',
  '연희동 주택 개조 와인바 테라스', '동대문 DDP 근처 루프탑', '성북천 산책로 야외 테이블', '신촌 연세로 야외 테라스 펍'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
