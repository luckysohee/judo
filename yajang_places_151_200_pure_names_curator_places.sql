-- Places 테이블에 장소 추가 (상호명만)
-- 1. 청진옥
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '청진옥',
  '',
  37.571717650682224,
  126.97944890786793,
  NOW()
);

-- 2. 유카바
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '유카바',
  '',
  NULL,
  NULL,
  NOW()
);

-- 3. 이춘복참치
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '이춘복참치',
  '',
  37.54213571979466,
  126.97305821512782,
  NOW()
);

-- 4. 와이키키비치펍
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '와이키키비치펍',
  '',
  37.5348756358332,
  126.993222778372,
  NOW()
);

-- 5. 동다리식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동다리식당',
  '',
  NULL,
  NULL,
  NOW()
);

-- 6. 무드서울
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '무드서울',
  '',
  37.51255698503471,
  126.99484790486558,
  NOW()
);

-- 7. 목포집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '목포집',
  '',
  37.397080192005,
  126.920832712529,
  NOW()
);

-- 8. 백만불식품
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '백만불식품',
  '',
  37.5660260408054,
  126.998668893112,
  NOW()
);

-- 9. 탭샵바 점
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '탭샵바 점',
  '',
  NULL,
  NULL,
  NOW()
);

-- 10. 쿠시무라
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '쿠시무라',
  '',
  37.54599652512562,
  126.92228235701236,
  NOW()
);

-- 11. 청평숯불갈비
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '청평숯불갈비',
  '',
  37.4962299588561,
  127.136107792084,
  NOW()
);

-- 12. 화포식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '화포식당',
  '',
  37.462845953675654,
  126.68135182010316,
  NOW()
);

-- 13. 전주식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '전주식당',
  '',
  35.1598812297922,
  129.06638044390826,
  NOW()
);

-- 14. 공항동라무진
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '공항동라무진',
  '',
  NULL,
  NULL,
  NOW()
);

-- 15. 바피크닉
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '바피크닉',
  '',
  37.5569761219875,
  126.978120766247,
  NOW()
);

-- 16. 창덕궁포차
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '창덕궁포차',
  '',
  37.58302601504721,
  127.00064532603896,
  NOW()
);

-- 17. 남포동꽃새우
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '남포동꽃새우',
  '',
  35.0986745024346,
  129.026167930625,
  NOW()
);

-- 18. 와인포차차
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '와인포차차',
  '',
  NULL,
  NULL,
  NOW()
);

-- 19. 평남면옥
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '평남면옥',
  '',
  37.90386340952936,
  127.05118764639475,
  NOW()
);

-- 20. 구복만두
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '구복만두',
  '',
  37.54540633237531,
  126.97299140639474,
  NOW()
);

-- 21. 산림식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '산림식당',
  '',
  36.85902095608721,
  128.47363962549144,
  NOW()
);

-- 22. 야스노야 지
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '야스노야 지',
  '',
  37.5467265098714,
  126.978409039064,
  NOW()
);

-- 23. 무드
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '무드',
  '',
  37.55639102097137,
  126.90575936665408,
  NOW()
);

-- 24. 서대문양꼬치
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '서대문양꼬치',
  '',
  37.5621904976658,
  126.924194185744,
  NOW()
);

-- 25. 정식카페
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '정식카페',
  '',
  37.5256748650022,
  127.041084828271,
  NOW()
);

-- Curator_Place 관계 추가
-- 1. 청진옥 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '청진옥' LIMIT 1),
  false,
  NOW()
);

-- 2. 유카바 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '유카바' LIMIT 1),
  false,
  NOW()
);

-- 3. 이춘복참치 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '이춘복참치' LIMIT 1),
  false,
  NOW()
);

-- 4. 와이키키비치펍 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '와이키키비치펍' LIMIT 1),
  false,
  NOW()
);

-- 5. 동다리식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동다리식당' LIMIT 1),
  false,
  NOW()
);

-- 6. 무드서울 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '무드서울' LIMIT 1),
  false,
  NOW()
);

-- 7. 목포집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '목포집' LIMIT 1),
  false,
  NOW()
);

-- 8. 백만불식품 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '백만불식품' LIMIT 1),
  false,
  NOW()
);

-- 9. 탭샵바 점 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '탭샵바 점' LIMIT 1),
  false,
  NOW()
);

-- 10. 쿠시무라 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '쿠시무라' LIMIT 1),
  false,
  NOW()
);

-- 11. 청평숯불갈비 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '청평숯불갈비' LIMIT 1),
  false,
  NOW()
);

-- 12. 화포식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '화포식당' LIMIT 1),
  false,
  NOW()
);

-- 13. 전주식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '전주식당' LIMIT 1),
  false,
  NOW()
);

-- 14. 공항동라무진 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '공항동라무진' LIMIT 1),
  false,
  NOW()
);

-- 15. 바피크닉 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '바피크닉' LIMIT 1),
  false,
  NOW()
);

-- 16. 창덕궁포차 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '창덕궁포차' LIMIT 1),
  false,
  NOW()
);

-- 17. 남포동꽃새우 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '남포동꽃새우' LIMIT 1),
  false,
  NOW()
);

-- 18. 와인포차차 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '와인포차차' LIMIT 1),
  false,
  NOW()
);

-- 19. 평남면옥 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '평남면옥' LIMIT 1),
  false,
  NOW()
);

-- 20. 구복만두 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '구복만두' LIMIT 1),
  false,
  NOW()
);

-- 21. 산림식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '산림식당' LIMIT 1),
  false,
  NOW()
);

-- 22. 야스노야 지 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '야스노야 지' LIMIT 1),
  false,
  NOW()
);

-- 23. 무드 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '무드' LIMIT 1),
  false,
  NOW()
);

-- 24. 서대문양꼬치 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '서대문양꼬치' LIMIT 1),
  false,
  NOW()
);

-- 25. 정식카페 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '정식카페' LIMIT 1),
  false,
  NOW()
);
