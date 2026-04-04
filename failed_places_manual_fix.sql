-- 실패한 장소들 수동 처리 SQL
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 1-50번 실패한 장소들 (8개) - 동네 제거
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '곤로', '', 37.5480, 126.9230, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '곤로');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '더스팟팹', '', 37.5690, 126.9930, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '더스팟팹');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '방울과꼬막', '', 37.5400, 126.9980, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방울과꼬막');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '창화당', '', 37.5450, 127.0550, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '창화당');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '기와탭룸', '', 37.5800, 126.9850, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '기와탭룸');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '하니칼국수', '', 37.5600, 127.0200, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '하니칼국수');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '갯벌의진주', '', 37.5300, 127.1000, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '갯벌의진주');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강가네 맷돌빈대떡', '', 37.5400, 126.9980, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강가네 맷돌빈대떡');

-- 21-50번 실패한 장소들 (3개)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '갯벌의진주', '', 37.5300, 127.1000, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '갯벌의진주');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '백곰막걸리', '', 37.5170, 127.0500, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '백곰막걸리');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '어반소스', '', 37.5450, 127.0550, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '어반소스');

-- 51-100번 실패한 장소들 (5개)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '창화당 성수점', '', 37.5450, 127.0550, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '창화당 성수점');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '정식바', '', 37.5170, 127.0500, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '정식바');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '진미평양냉면', '', 37.5170, 127.0200, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '진미평양냉면');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성부숙성고기', '', 37.5450, 127.0550, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성부숙성고기');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '미아논나', '', 37.5900, 126.9500, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '미아논나');

-- 101-150번 실패한 장소들 (3개)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '엘피노708', '', 37.5300, 126.9900, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '엘피노708');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '계식당', '', 37.5270, 127.0280, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '계식당');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '스피크이지사자', '', 37.5800, 126.9850, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '스피크이지사자');

-- 151-200번 실패한 장소들 (5개) - 동네 제거
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '유카바', '', 37.5400, 126.9980, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '유카바');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동다리식당', '', 37.5450, 127.0450, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동다리식당');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '탭샵바', '', 37.5600, 127.0200, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '탭샵바');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '라무진', '', 37.5600, 126.8100, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '라무진');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '와인포차차', '', 37.5720, 126.9650, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '와인포차차');

-- 201-250번 실패한 장소들 (5개) - 동네 제거
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '부부펍', '', 37.5450, 127.0550, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '부부펍');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '바오26', '', 37.5400, 126.9980, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '바오26');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '티켓정거장', '', 37.5660, 126.9900, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '티켓정거장');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '우리집', '', 37.5600, 127.0200, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '우리집');

INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '바앤참', '', 37.5720, 126.9650, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '바앤참');

-- Curator_Place 관계 추가 (실패한 장소들) - 동네 제거
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '곤로', '더스팟팹', '방울과꼬막', '창화당', '기와탭룸',
  '하니칼국수', '갯벌의진주', '강가네 맷돌빈대떡', '백곰막걸리', '어반소스',
  '창화당 성수점', '정식바', '진미평양냉면', '성부숙성고기', '미아논나',
  '엘피노708', '계식당', '스피크이지사자', '유카바', '동다리식당',
  '탭샵바', '라무진', '와인포차차', '부부펍', '바오26',
  '티켓정거장', '우리집', '바앤참'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
