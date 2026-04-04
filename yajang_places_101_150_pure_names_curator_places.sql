-- Places 테이블에 장소 추가 (상호명만)
-- 1. 복집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '복집',
  '',
  35.1623954243218,
  129.164447392476,
  NOW()
);

-- 2. 서식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '서식당',
  '',
  37.56664357270615,
  126.92911231824006,
  NOW()
);

-- 3. 전주단지네
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '전주단지네',
  '',
  36.3229003849842,
  127.410134532208,
  NOW()
);

-- 4. 더백푸드트럭
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '더백푸드트럭',
  '',
  37.5475283938128,
  126.98404424469781,
  NOW()
);

-- 5. 엘피노708
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '엘피노708',
  '',
  NULL,
  NULL,
  NOW()
);

-- 6. 은주정
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '은주정',
  '',
  37.56867047080973,
  126.99975663427007,
  NOW()
);

-- 7. 라싸브어
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '라싸브어',
  '',
  37.4970543885099,
  126.998452994747,
  NOW()
);

-- 8. 마산해물아구찜
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '마산해물아구찜',
  '',
  37.573588395665,
  126.988014298694,
  NOW()
);

-- 9. 우육미
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '우육미',
  '',
  37.5652198412515,
  127.013007581183,
  NOW()
);

-- 10. 미라이
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '미라이',
  '',
  37.52105696852104,
  127.02617063446856,
  NOW()
);

-- 11. 오통영
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '오통영',
  '',
  34.84217839545,
  128.422601231477,
  NOW()
);

-- 12. 계식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '계식당',
  '',
  NULL,
  NULL,
  NOW()
);

-- 13. 타츠
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '타츠',
  '',
  37.64619623690542,
  127.23594939748027,
  NOW()
);

-- 14. 호수집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '호수집',
  '',
  37.5590607950843,
  126.968681156219,
  NOW()
);

-- 15. 금목
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '금목',
  '',
  37.48419305691,
  126.977398148409,
  NOW()
);

-- 16. 장수보쌈
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '장수보쌈',
  '',
  37.56807849205656,
  127.00242231879236,
  NOW()
);

-- 17. 까사델비노
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '까사델비노',
  '',
  37.5263540535859,
  127.044048059341,
  NOW()
);

-- 18. 우진
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '우진',
  '',
  37.5044432813394,
  126.64884101474,
  NOW()
);

-- 19. 바오차이
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '바오차이',
  '',
  37.565924616711655,
  126.9889187765764,
  NOW()
);

-- 20. 족발1987
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '족발1987',
  '',
  37.559804520526,
  126.923979297653,
  NOW()
);

-- 21. 야마야
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '야마야',
  '',
  37.5246544048455,
  126.923476495426,
  NOW()
);

-- 22. 한추
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '한추',
  '',
  37.52400834370954,
  127.02334917546781,
  NOW()
);

-- 23. 바피크닉
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '바피크닉',
  '',
  37.5569761219875,
  126.978120766247,
  NOW()
);

-- 24. 원조녹두
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '원조녹두',
  '',
  37.48010389430981,
  126.85567829166985,
  NOW()
);

-- 25. 스피크이지사자
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '스피크이지사자',
  '',
  NULL,
  NULL,
  NOW()
);

-- Curator_Place 관계 추가
-- 1. 복집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '복집' LIMIT 1),
  false,
  NOW()
);

-- 2. 서식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '서식당' LIMIT 1),
  false,
  NOW()
);

-- 3. 전주단지네 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '전주단지네' LIMIT 1),
  false,
  NOW()
);

-- 4. 더백푸드트럭 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '더백푸드트럭' LIMIT 1),
  false,
  NOW()
);

-- 5. 엘피노708 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '엘피노708' LIMIT 1),
  false,
  NOW()
);

-- 6. 은주정 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '은주정' LIMIT 1),
  false,
  NOW()
);

-- 7. 라싸브어 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '라싸브어' LIMIT 1),
  false,
  NOW()
);

-- 8. 마산해물아구찜 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '마산해물아구찜' LIMIT 1),
  false,
  NOW()
);

-- 9. 우육미 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '우육미' LIMIT 1),
  false,
  NOW()
);

-- 10. 미라이 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '미라이' LIMIT 1),
  false,
  NOW()
);

-- 11. 오통영 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '오통영' LIMIT 1),
  false,
  NOW()
);

-- 12. 계식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '계식당' LIMIT 1),
  false,
  NOW()
);

-- 13. 타츠 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '타츠' LIMIT 1),
  false,
  NOW()
);

-- 14. 호수집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '호수집' LIMIT 1),
  false,
  NOW()
);

-- 15. 금목 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '금목' LIMIT 1),
  false,
  NOW()
);

-- 16. 장수보쌈 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '장수보쌈' LIMIT 1),
  false,
  NOW()
);

-- 17. 까사델비노 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '까사델비노' LIMIT 1),
  false,
  NOW()
);

-- 18. 우진 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '우진' LIMIT 1),
  false,
  NOW()
);

-- 19. 바오차이 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '바오차이' LIMIT 1),
  false,
  NOW()
);

-- 20. 족발1987 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '족발1987' LIMIT 1),
  false,
  NOW()
);

-- 21. 야마야 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '야마야' LIMIT 1),
  false,
  NOW()
);

-- 22. 한추 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '한추' LIMIT 1),
  false,
  NOW()
);

-- 23. 바피크닉 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '바피크닉' LIMIT 1),
  false,
  NOW()
);

-- 24. 원조녹두 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '원조녹두' LIMIT 1),
  false,
  NOW()
);

-- 25. 스피크이지사자 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '스피크이지사자' LIMIT 1),
  false,
  NOW()
);
