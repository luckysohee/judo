-- 큐레이터 장소 데이터 import (display_name 기반) - curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c
-- display_name으로 카카오지도 검색 성공한 장소들만 포함
-- 카카오 지도 정보는 place_id만 저장, 나머지는 API로 바로 표시

-- 1. 감미옥 (카카오 ID: 8725439)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '감미옥', '서울 서초구 잠원동 72-2', 37.5088971582088, 127.003732400403, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '감미옥');

-- 2. 문래옥상 (카카오 ID: 478117977)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '문래옥상', '서울 영등포구 문래동3가 58-20', 37.51482445124475, 126.8942651924607, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '문래옥상');

-- 3. 성수옥상 (카카오 ID: 96799309)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성수옥상', '서울 성동구 성수동2가 272-35', 37.5426460151374, 127.059451118514, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성수옥상');

-- 4. 이진칸 (카카오 ID: 1341481623)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '이진칸', '서울 용산구 이태원동 131-3', 37.5332642739106, 126.993506139284, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이진칸');

-- 5. 환원당 (카카오 ID: 485950525)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '환원당', '서울 광진구 화양동 94-25', 37.5455393854284, 127.073623128116, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '환원당');

-- 6. 뚝도지기 (카카오 ID: 38620260)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '뚝도지기', '서울 성동구 성수동2가 335-36', 37.5378042109473, 127.054608382192, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '뚝도지기');

-- 7. 복숭아꽃살구꽃 (카카오 ID: 20305216)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '복숭아꽃살구꽃', '서울 금천구 가산동 83-26', 37.4823304410021, 126.885196132441, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '복숭아꽃살구꽃');

-- 8. 달 루프탑 (카카오 ID: 1455581025)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '달 루프탑', '서울 노원구 공릉동 386-2', 37.6261262394412, 127.073709331824, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '달 루프탑');

-- 9. 인디아나호프 (카카오 ID: 21332315)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '인디아나호프', '서울 강남구 청담동 23', 37.521342, 127.039995, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '인디아나호프');

-- 10. 코드라이트 워크카페 (카카오 ID: 2006211527)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '코드라이트 워크카페', '서울 광진구 중곡동 639-6', 37.555889, 127.077773, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '코드라이트 워크카페');

-- 11. 태태삼겹 신당2호점 (카카오 ID: 239871034)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '태태삼겹 신당2호점', '서울 중구 신당동 250-7', 37.565296, 127.013594, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '태태삼겹 신당2호점');

-- 12. 11-14번지 캐주얼펍 (카카오 ID: 18832117)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '11-14번지 캐주얼펍', '서울 종로구 관철동 11-14', 37.568662, 126.985856, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '11-14번지 캐주얼펍');

-- 13. 모노맨션 신흥시장점 (카카오 ID: 84903041)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '모노맨션 신흥시장점', '서울 용산구 용산동2가 1-63', 37.544976, 126.984927, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '모노맨션 신흥시장점');

-- 14. 신천포차 (카카오 ID: 7980341)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신천포차', '서울 송파구 잠실동 208-6', 37.509281, 127.085592, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신천포차');

-- 15. 역촌호프와노가리 (카카오 ID: 929028146)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '역촌호프와노가리', '서울 은평구 역촌동 27-13', 37.604263, 126.921582, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '역촌호프와노가리');

-- 16. 은하수 (카카오 ID: 1438270542)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '은하수', '서울 강남구 역삼동 811', 37.503727, 127.026469, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '은하수');

-- 17. 퍼그 피자하우스 강남점 (카카오 ID: 382622582)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '퍼그 피자하우스 강남점', '서울 강남구 역삼동 812-13', 37.563093, 126.925816, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '퍼그 피자하우스 강남점');

-- 18. 구이천국 (카카오 ID: 1978639744)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '구이천국', '서울 동작구 노량진동 15-27', 37.557801, 126.922957, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '구이천국');

-- 19. 구워삶다 (카카오 ID: 27583385)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '구워삶다', '서울 마포구 서교동 397-10', 37.502744, 127.027429, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '구워삶다');

-- 20. 술잔코드 (카카오 ID: 35686601)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '술잔코드', '서울 마포구 서교동 396-4', 37.514236, 126.942478, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '술잔코드');

-- 21. 마초나초 (카카오 ID: 6504788)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '마초나초', '서울 마포구 망원동 418-17', 37.55011, 126.91856, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마초나초');

-- 22. 폴바셋 한남커피스테이션로스트웍스 (카카오 ID: 26852037)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '폴바셋 한남커피스테이션로스트웍스', '서울 용산구 한남동 257-13', 37.55083, 126.912853, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '폴바셋 한남커피스테이션로스트웍스');

-- 23. 트리니티와인앤컬처 (카카오 ID: 1779163964)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '트리니티와인앤컬처', '서울 용산구 한남동 274-10', 37.554046, 126.898694, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '트리니티와인앤컬처');

-- 24. 도연회포차 (카카오 ID: 557142812)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '도연회포차', '서울 종로구 관수동 4-1', 37.56235, 126.991998, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '도연회포차');

-- 25. 그린마일커피 북촌점 (카카오 ID: 1245067143)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '그린마일커피 북촌점', '서울 종로구 가회동 11-49', 37.534093, 127.008086, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '그린마일커피 북촌점');

-- 26. 쏘플파티룸 낙산파라도르 루프탑 (카카오 ID: 1759990263)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '쏘플파티룸 낙산파라도르 루프탑', '서울 성북구 삼선동1가 279-1', 37.533138, 127.008949, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '쏘플파티룸 낙산파라도르 루프탑');

-- 27. 판자집 (카카오 ID: 8121543)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '판자집', '서울 서대문구 창천동 29-18', 37.570347, 126.991357, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '판자집');

-- 28. 헤르츠호텔 (카카오 ID: 27405806)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '헤르츠호텔', '서울 종로구 낙원동 108-1', 37.580714, 126.985099, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '헤르츠호텔');

-- 29. 영동호프&식당 (카카오 ID: 637150774)
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '영동호프&식당', '서울 중구 수표동 11-3', 37.581965, 127.002617, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '영동호프&식당');

-- Curator_Place 관계 추가 (display_name 기반)
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '감미옥',
  '문래옥상',
  '성수옥상',
  '이진칸',
  '환원당',
  '뚝도지기',
  '복숭아꽃살구꽃',
  '달 루프탑',
  '인디아나호프',
  '코드라이트 워크카페',
  '태태삼겹 신당2호점',
  '11-14번지 캐주얼펍',
  '모노맨션 신흥시장점',
  '신천포차',
  '역촌호프와노가리',
  '은하수',
  '퍼그 피자하우스 강남점',
  '구이천국',
  '구워삶다',
  '술잔코드',
  '마초나초',
  '폴바셋 한남커피스테이션로스트웍스',
  '트리니티와인앤컬처',
  '도연회포차',
  '그린마일커피 북촌점',
  '쏘플파티룸 낙산파라도르 루프탑',
  '판자집',
  '헤르츠호텔',
  '영동호프&식당'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
