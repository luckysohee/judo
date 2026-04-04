-- 야장마스터 장소 데이터 import (101-127번) - 바로 복붙용
-- curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c

-- 101. 연남동 끝자락 숲길 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '연남동 끝자락 숲길 테라스', '', 37.5568, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '연남동 끝자락 숲길 테라스');

-- 102. 신사동 가로수길 뒤뜰 펍
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신사동 가로수길 뒤뜰 펍', '', 37.5178, 127.0204, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신사동 가로수길 뒤뜰 펍');

-- 103. 종로 관철동 청계천변 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '종로 관철동 청계천변 야장', '', 37.5724, 126.9896, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '종로 관철동 청계천변 야장');

-- 104. 성북동 언덕 위 야외 와인바
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성북동 언덕 위 야외 와인바', '', 37.5837, 127.0112, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북동 언덕 위 야외 와인바');

-- 105. 합정동 당인리 발전소길 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '합정동 당인리 발전소길 야장', '', 37.5568, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '합정동 당인리 발전소길 야장');

-- 106. 청담동 루프탑 라운지
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '청담동 루프탑 라운지', '', 37.5144, 126.9926, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청담동 루프탑 라운지');

-- 107. 왕십리 행당시장 노천 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '왕십리 행당시장 노천 야장', '', 37.5748, 126.9589, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '왕십리 행당시장 노천 야장');

-- 108. 서대문 연희맛로 마당 술집
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서대문 연희맛로 마당 술집', '', 37.5559, 126.9547, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서대문 연희맛로 마당 술집');

-- 109. 압구정 로데오 골목 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '압구정 로데오 골목 테라스', '', 37.5278, 127.0257, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '압구정 로데오 골목 테라스');

-- 110. 용산 남영동 스테이크 골목 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '용산 남영동 스테이크 골목 야장', '', 37.5344, 126.9658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '용산 남영동 스테이크 골목 야장');

-- 111. 성수동 서울숲 입구 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '성수동 서울숲 입구 테라스', '', 37.5448, 127.0656, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성수동 서울숲 입구 테라스');

-- 112. 이태원 우사단길 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '이태원 우사단길 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이태원 우사단길 루프탑');

-- 113. 신림역 별빛거리 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신림역 별빛거리 야장', '', 37.5724, 126.9896, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신림역 별빛거리 야장');

-- 114. 공릉동 경춘선 숲길 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '공릉동 경춘선 숲길 테라스', '', 37.6268, 127.0326, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '공릉동 경춘선 숲길 테라스');

-- 115. 잠실 석촌호수 테라스 카페
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '잠실 석촌호수 테라스 카페', '', 37.5136, 127.0866, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '잠실 석촌호수 테라스 카페');

-- 116. 충무로 필동 면옥 근처 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '충무로 필동 면옥 근처 야장', '', 37.5632, 126.9952, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '충무로 필동 면옥 근처 야장');

-- 117. 상도동 중앙대 정문 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '상도동 중앙대 정문 루프탑', '', 37.4766, 126.9512, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '상도동 중앙대 정문 루프탑');

-- 118. 영등포 타임스퀘어 뒤 골목 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '영등포 타임스퀘어 뒤 골목 야장', '', 37.5134, 126.8969, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '영등포 타임스퀘어 뒤 골목 야장');

-- 119. 강남역 신분당선 근처 테라스 펍
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '강남역 신분당선 근처 테라스 펍', '', 37.5275, 126.8658, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '강남역 신분당선 근처 테라스 펍');

-- 120. 방배동 카페골목 루프탑 가든
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '방배동 카페골목 루프탑 가든', '', 37.4922, 126.9882, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방배동 카페골목 루프탑 가든');

-- 121. 신당동 중앙시장 입구 야장
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '신당동 중앙시장 입구 야장', '', 37.5652, 127.0172, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신당동 중앙시장 입구 야장');

-- 122. 혜화동 낙산공원 입구 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '혜화동 낙산공원 입구 테라스', '', 37.5846, 126.9839, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '혜화동 낙산공원 입구 테라스');

-- 123. 망원동 포은로 골목 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '망원동 포은로 골목 테라스', '', 37.5568, 126.9087, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '망원동 포은로 골목 테라스');

-- 124. 여의도 KBS 앞 야외 치맥
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '여의도 KBS 앞 야외 치맥', '', 37.5251, 126.9237, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '여의도 KBS 앞 야외 치맥');

-- 125. 서대문 독립문 공원 옆 테라스
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '서대문 독립문 공원 옆 테라스', '', 37.5748, 126.9589, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서대문 독립문 공원 옆 테라스');

-- 126. 광화문 경희궁길 야외 카페
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '광화문 경희궁길 야외 카페', '', 37.5717, 126.9765, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '광화문 경희궁길 야외 카페');

-- 127. 동작구 노량진 수산시장 루프탑
INSERT INTO places (name, address, lat, lng, created_at) 
SELECT '동작구 노량진 수산시장 루프탑', '', 37.5744, 126.9894, NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동작구 노량진 수산시장 루프탑');

-- Curator_Place 관계 추가 (101-127번)
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '연남동 끝자락 숲길 테라스', '신사동 가로수길 뒤뜰 펍', '종로 관철동 청계천변 야장', '성북동 언덕 위 야외 와인바',
  '합정동 당인리 발전소길 야장', '청담동 루프탑 라운지', '왕십리 행당시장 노천 야장', '서대문 연희맛로 마당 술집',
  '압구정 로데오 골목 테라스', '용산 남영동 스테이크 골목 야장', '성수동 서울숲 입구 테라스', '이태원 우사단길 루프탑',
  '신림역 별빛거리 야장', '공릉동 경춘선 숲길 테라스', '잠실 석촌호수 테라스 카페', '충무로 필동 면옥 근처 야장',
  '상도동 중앙대 정문 루프탑', '영등포 타임스퀘어 뒤 골목 야장', '강남역 신분당선 근처 테라스 펍', '방배동 카페골목 루프탑 가든',
  '신당동 중앙시장 입구 야장', '혜화동 낙산공원 입구 테라스', '망원동 포은로 골목 테라스', '여의도 KBS 앞 야외 치맥',
  '서대문 독립문 공원 옆 테라스', '광화문 경희궁길 야외 카페', '동작구 노량진 수산시장 루프탑'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);
