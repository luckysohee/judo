-- Places 테이블에 장소 추가 (상호명만)
-- 1. 평원숯불갈비
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '평원숯불갈비',
  '',
  37.572197749404,
  127.005288643309,
  NOW()
);

-- 2. 계림
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '계림',
  '',
  36.36066441230963,
  127.29342025992709,
  NOW()
);

-- 3. 산울림1992
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '산울림1992',
  '',
  37.55464224823846,
  126.93054626122678,
  NOW()
);

-- 4. 대원식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '대원식당',
  '',
  34.95010189963333,
  127.49017155220966,
  NOW()
);

-- 5. 거북이집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '거북이집',
  '',
  35.0809644141976,
  126.765192853464,
  NOW()
);

-- 6. 창화당 점
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '창화당 점',
  '',
  NULL,
  NULL,
  NOW()
);

-- 7. 영번지
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '영번지',
  '',
  37.5061941654576,
  127.041371600279,
  NOW()
);

-- 8. 독일주택
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '독일주택',
  '',
  37.5829989858595,
  127.000520789247,
  NOW()
);

-- 9. 방울과꼬막
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '방울과꼬막',
  '',
  37.532679949778,
  127.005774611871,
  NOW()
);

-- 10. 시미시미
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '시미시미',
  '',
  37.5744679935232,
  126.990509132817,
  NOW()
);

-- 11. 어머니대성집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '어머니대성집',
  '',
  37.57741837425039,
  127.02858466713235,
  NOW()
);

-- 12. 골목집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '골목집',
  '',
  37.28558174323745,
  127.01391556633621,
  NOW()
);

-- 13. 우라만
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '우라만',
  '',
  37.5368442961594,
  127.056957310681,
  NOW()
);

-- 14. 혜화돌쇠아저씨
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '혜화돌쇠아저씨',
  '',
  37.58281157270948,
  127.00134499146532,
  NOW()
);

-- 15. 정식바
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '정식바',
  '',
  NULL,
  NULL,
  NOW()
);

-- 16. 진미평양냉
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '진미평양냉',
  '',
  NULL,
  NULL,
  NOW()
);

-- 17. 탭샵바
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '탭샵바',
  '',
  37.5179739512432,
  127.02517978628,
  NOW()
);

-- 18. 코마치
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '코마치',
  '',
  37.54734668783862,
  127.10805073840943,
  NOW()
);

-- 19. 야스노야
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '야스노야',
  '',
  37.5467265098714,
  126.978409039064,
  NOW()
);

-- 20. 진진
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '진진',
  '',
  37.55376325035565,
  126.91845251500338,
  NOW()
);

-- 21. 바참
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '바참',
  '',
  37.579157035941925,
  126.97037314326242,
  NOW()
);

-- 22. 성부숙성고기
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '성부숙성고기',
  '',
  NULL,
  NULL,
  NOW()
);

-- 23. 미아논나
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '미아논나',
  '',
  NULL,
  NULL,
  NOW()
);

-- 24. 꺼거
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '꺼거',
  '',
  37.5315503097785,
  126.97112624504624,
  NOW()
);

-- 25. 대한옥
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '대한옥',
  '',
  37.5193620967929,
  126.910884990204,
  NOW()
);

-- Curator_Place 관계 추가
-- 1. 평원숯불갈비 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '평원숯불갈비' LIMIT 1),
  false,
  NOW()
);

-- 2. 계림 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '계림' LIMIT 1),
  false,
  NOW()
);

-- 3. 산울림1992 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '산울림1992' LIMIT 1),
  false,
  NOW()
);

-- 4. 대원식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '대원식당' LIMIT 1),
  false,
  NOW()
);

-- 5. 거북이집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '거북이집' LIMIT 1),
  false,
  NOW()
);

-- 6. 창화당 점 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '창화당 점' LIMIT 1),
  false,
  NOW()
);

-- 7. 영번지 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '영번지' LIMIT 1),
  false,
  NOW()
);

-- 8. 독일주택 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '독일주택' LIMIT 1),
  false,
  NOW()
);

-- 9. 방울과꼬막 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '방울과꼬막' LIMIT 1),
  false,
  NOW()
);

-- 10. 시미시미 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '시미시미' LIMIT 1),
  false,
  NOW()
);

-- 11. 어머니대성집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '어머니대성집' LIMIT 1),
  false,
  NOW()
);

-- 12. 골목집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '골목집' LIMIT 1),
  false,
  NOW()
);

-- 13. 우라만 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '우라만' LIMIT 1),
  false,
  NOW()
);

-- 14. 혜화돌쇠아저씨 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '혜화돌쇠아저씨' LIMIT 1),
  false,
  NOW()
);

-- 15. 정식바 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '정식바' LIMIT 1),
  false,
  NOW()
);

-- 16. 진미평양냉 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '진미평양냉' LIMIT 1),
  false,
  NOW()
);

-- 17. 탭샵바 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '탭샵바' LIMIT 1),
  false,
  NOW()
);

-- 18. 코마치 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '코마치' LIMIT 1),
  false,
  NOW()
);

-- 19. 야스노야 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '야스노야' LIMIT 1),
  false,
  NOW()
);

-- 20. 진진 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '진진' LIMIT 1),
  false,
  NOW()
);

-- 21. 바참 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '바참' LIMIT 1),
  false,
  NOW()
);

-- 22. 성부숙성고기 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '성부숙성고기' LIMIT 1),
  false,
  NOW()
);

-- 23. 미아논나 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '미아논나' LIMIT 1),
  false,
  NOW()
);

-- 24. 꺼거 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '꺼거' LIMIT 1),
  false,
  NOW()
);

-- 25. 대한옥 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '대한옥' LIMIT 1),
  false,
  NOW()
);
