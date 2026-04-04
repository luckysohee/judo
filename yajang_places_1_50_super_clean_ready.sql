-- 야장마스터 장소 데이터 import (1-50번) - 순수 상호명만 저장
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 1. 만선호프 본점
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '만선호프 본점', '', 37.5690, 126.9930, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '만선호프 본점');

-- 2. 시미시미
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '시미시미', '', 37.5710, 126.9850, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '시미시미');

-- 3. 필동해물
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '필동해물', '', 38.0500, 128.6100, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '필동해물');

-- 4. 화이팅
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '화이팅', '', 37.5270, 127.0280, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '화이팅');

-- 5. 채윤희
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '채윤희', '', 37.5140, 126.8890, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '채윤희');

-- 6. 테르트르
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '테르트르', '', 37.5760, 126.9820, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '테르트르');

-- 7. 해방촌 오리올
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '해방촌 오리올', '', 37.5500, 126.9650, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '해방촌 오리올');

-- 8. 3가 대원식당
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '3가 대원식당', '', 37.5700, 126.9830, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '3가 대원식당');

-- 9. 망원 복덕방
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '망원 복덕방', '', 37.5560, 126.9150, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '망원 복덕방');

-- 10. 남영동 양문
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '남영동 양문', '', 37.5450, 126.9700, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '남영동 양문');

-- 11. 하얀집
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '하얀집', '', 37.5630, 126.9970, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '하얀집');

-- 12. 청담 고센
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '청담 고센', '', 37.5170, 127.0500, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청담 고센');

-- 13. 보석
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '보석', '', 37.5660, 126.9900, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '보석');

-- 14. 옥상달빛
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '옥상달빛', '', 37.5480, 126.9230, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '옥상달빛');

-- 15. 서촌 안주마을
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서촌 안주마을', '', 37.5720, 126.9650, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서촌 안주마을');

-- 16. 산울림1992
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '산울림1992', '', 37.5500, 126.9180, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '산울림1992');

-- 17. 도루묵
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '도루묵', '', 37.5670, 126.9910, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '도루묵');

-- Curator_Place 관계 추가 (1-50번)
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '만선호프 본점', '시미시미', '필동해물', '화이팅', '채윤희',
  '테르트르', '해방촌 오리올', '3가 대원식당', '망원 복덕방', '남영동 양문',
  '하얀집', '청담 고센', '보석', '옥상달빛', '서촌 안주마을',
  '산울림1992', '도루묵'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
