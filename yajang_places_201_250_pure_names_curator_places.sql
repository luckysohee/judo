-- Places 테이블에 장소 추가 (상호명만)
-- 1. 평안도족발집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '평안도족발집',
  '',
  37.56028474298094,
  127.00606648419787,
  NOW()
);

-- 2. 몰토
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '몰토',
  '',
  37.5652455170996,
  126.992036079643,
  NOW()
);

-- 3. 대도식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '대도식당',
  '',
  33.2439763325437,
  126.562386711638,
  NOW()
);

-- 4. 코브라파스타클럽
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '코브라파스타클럽',
  '',
  37.555453039477,
  126.904583545267,
  NOW()
);

-- 5. 오가네잔치국수
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '오가네잔치국수',
  '',
  36.6288723045348,
  127.4909152652,
  NOW()
);

-- 6. 버뮤다삼각지
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '버뮤다삼각지',
  '',
  37.531972271010105,
  126.97234910280656,
  NOW()
);

-- 7. 동강민물매운탕
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동강민물매운탕',
  '',
  37.8225112044262,
  127.049039267132,
  NOW()
);

-- 8. 바티칸
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '바티칸',
  '',
  37.5137698805431,
  127.109142465523,
  NOW()
);

-- 9. 부부펍
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '부부펍',
  '',
  NULL,
  NULL,
  NOW()
);

-- 10. 대문점
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '대문점',
  '',
  37.5186034914123,
  126.908578292214,
  NOW()
);

-- 11. 영동소금구이
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '영동소금구이',
  '',
  37.4920152609427,
  127.031915016215,
  NOW()
);

-- 12. 가락
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '가락',
  '',
  37.4991678487017,
  127.104547917815,
  NOW()
);

-- 13. 헬카페 스피리터스
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '헬카페 스피리터스',
  '',
  37.5193102506462,
  126.975349160467,
  NOW()
);

-- 14. 은성보쌈
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '은성보쌈',
  '',
  37.54844638189142,
  127.02231569873973,
  NOW()
);

-- 15. 바오26
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '바오26',
  '',
  NULL,
  NULL,
  NOW()
);

-- 16. 광평
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '광평',
  '',
  36.1113680733406,
  128.357881958519,
  NOW()
);

-- 17. 미자네
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '미자네',
  '',
  37.4832691290124,
  126.928760388081,
  NOW()
);

-- 18. 티켓정거장
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '티켓정거장',
  '',
  NULL,
  NULL,
  NOW()
);

-- 19. 피우
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '피우',
  '',
  37.4722009803264,
  126.625689505605,
  NOW()
);

-- 20. 동우리집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동우리집',
  '',
  NULL,
  NULL,
  NOW()
);

-- 21. 진미식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '진미식당',
  '',
  37.550608920427024,
  126.95579734486303,
  NOW()
);

-- 22. 엘픽
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '엘픽',
  '',
  37.522349918227675,
  127.04660681759634,
  NOW()
);

-- 23. 바앤참
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '바앤참',
  '',
  NULL,
  NULL,
  NOW()
);

-- 24. 이모네포차
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '이모네포차',
  '',
  37.3984762569618,
  126.922773758154,
  NOW()
);

-- 25. 정든집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '정든집',
  '',
  37.31209825814634,
  126.89267039692065,
  NOW()
);

-- Curator_Place 관계 추가
-- 1. 평안도족발집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '평안도족발집' LIMIT 1),
  false,
  NOW()
);

-- 2. 몰토 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '몰토' LIMIT 1),
  false,
  NOW()
);

-- 3. 대도식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '대도식당' LIMIT 1),
  false,
  NOW()
);

-- 4. 코브라파스타클럽 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '코브라파스타클럽' LIMIT 1),
  false,
  NOW()
);

-- 5. 오가네잔치국수 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '오가네잔치국수' LIMIT 1),
  false,
  NOW()
);

-- 6. 버뮤다삼각지 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '버뮤다삼각지' LIMIT 1),
  false,
  NOW()
);

-- 7. 동강민물매운탕 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동강민물매운탕' LIMIT 1),
  false,
  NOW()
);

-- 8. 바티칸 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '바티칸' LIMIT 1),
  false,
  NOW()
);

-- 9. 부부펍 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '부부펍' LIMIT 1),
  false,
  NOW()
);

-- 10. 대문점 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '대문점' LIMIT 1),
  false,
  NOW()
);

-- 11. 영동소금구이 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '영동소금구이' LIMIT 1),
  false,
  NOW()
);

-- 12. 가락 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '가락' LIMIT 1),
  false,
  NOW()
);

-- 13. 헬카페 스피리터스 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '헬카페 스피리터스' LIMIT 1),
  false,
  NOW()
);

-- 14. 은성보쌈 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '은성보쌈' LIMIT 1),
  false,
  NOW()
);

-- 15. 바오26 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '바오26' LIMIT 1),
  false,
  NOW()
);

-- 16. 광평 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '광평' LIMIT 1),
  false,
  NOW()
);

-- 17. 미자네 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '미자네' LIMIT 1),
  false,
  NOW()
);

-- 18. 티켓정거장 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '티켓정거장' LIMIT 1),
  false,
  NOW()
);

-- 19. 피우 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '피우' LIMIT 1),
  false,
  NOW()
);

-- 20. 동우리집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동우리집' LIMIT 1),
  false,
  NOW()
);

-- 21. 진미식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '진미식당' LIMIT 1),
  false,
  NOW()
);

-- 22. 엘픽 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '엘픽' LIMIT 1),
  false,
  NOW()
);

-- 23. 바앤참 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '바앤참' LIMIT 1),
  false,
  NOW()
);

-- 24. 이모네포차 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '이모네포차' LIMIT 1),
  false,
  NOW()
);

-- 25. 정든집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '정든집' LIMIT 1),
  false,
  NOW()
);
