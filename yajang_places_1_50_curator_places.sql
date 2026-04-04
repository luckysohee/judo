-- Places 테이블에 장소 추가 (상호명만)
-- 1. 만선호프 본점
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '만선호프 본점',
  '',
  37.56724931479237,
  126.99178231800013,
  NOW()
);

-- 2. 익선동 시미시미
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '익선동 시미시미',
  '',
  37.5744679935232,
  126.990509132817,
  NOW()
);

-- 3. 해물
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '해물',
  '',
  38.19214711524039,
  128.5905399503119,
  NOW()
);

-- 4. 화이팅
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '화이팅',
  '',
  37.391519626676896,
  126.93028259794109,
  NOW()
);

-- 5. 동 곤로
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동 곤로',
  '',
  NULL,
  NULL,
  NOW()
);

-- 6. 시청 더스팟팹
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '시청 더스팟팹',
  '',
  NULL,
  NULL,
  NOW()
);

-- 7. 동 방울과꼬막
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동 방울과꼬막',
  '',
  NULL,
  NULL,
  NOW()
);

-- 8. 문래 채윤희
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '문래 채윤희',
  '',
  37.51539328494587,
  126.89460146605822,
  NOW()
);

-- 9. 창신동 테르트르
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '창신동 테르트르',
  '',
  37.57822498607935,
  127.01124719738597,
  NOW()
);

-- 10. 오리올
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '오리올',
  '',
  36.2233337161104,
  127.316346813265,
  NOW()
);

-- 11. 3가 대원식당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '3가 대원식당',
  '',
  34.95010189963333,
  127.49017155220966,
  NOW()
);

-- 12. 복덕방
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '복덕방',
  '',
  37.51101310156074,
  127.02369914929629,
  NOW()
);

-- 13. 연방 창화당
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '연방 창화당',
  '',
  NULL,
  NULL,
  NOW()
);

-- 14. 삼청동 기와탭룸
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '삼청동 기와탭룸',
  '',
  37.57868360829965,
  126.98168625791793,
  NOW()
);

-- 15. 동 양문
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동 양문',
  '',
  37.5493845223449,
  127.136928637902,
  NOW()
);

-- 16. 하얀집
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '하얀집',
  '',
  34.7294452583753,
  127.731934610729,
  NOW()
);

-- 17. 동 하니칼국수
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동 하니칼국수',
  '',
  NULL,
  NULL,
  NOW()
);

-- 18. 고센
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '고센',
  '',
  37.5251945000821,
  127.041459017307,
  NOW()
);

-- 19. 보석
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '보석',
  '',
  37.49798832052528,
  126.7233712629904,
  NOW()
);

-- 20. 옥상달빛
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '옥상달빛',
  '',
  34.8031850694646,
  126.388714435815,
  NOW()
);

-- 21. 동 갯벌의진주
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동 갯벌의진주',
  '',
  NULL,
  NULL,
  NOW()
);

-- 22. 안주마을
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '안주마을',
  '',
  37.576458094002795,
  126.97216738211803,
  NOW()
);

-- 23. 산울림1992
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '산울림1992',
  '',
  37.55464224823846,
  126.93054626122678,
  NOW()
);

-- 24. 도루묵
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '도루묵',
  '',
  37.565915697012706,
  126.9899261617223,
  NOW()
);

-- 25. 동 강가네 맷돌빈대떡
INSERT INTO places (name, address, lat, lng, created_at)
VALUES (
  '동 강가네 맷돌빈대떡',
  '',
  NULL,
  NULL,
  NOW()
);

-- Curator_Place 관계 추가
-- 1. 만선호프 본점 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '만선호프 본점' LIMIT 1),
  false,
  NOW()
);

-- 2. 익선동 시미시미 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '익선동 시미시미' LIMIT 1),
  false,
  NOW()
);

-- 3. 해물 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '해물' LIMIT 1),
  false,
  NOW()
);

-- 4. 화이팅 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '화이팅' LIMIT 1),
  false,
  NOW()
);

-- 5. 동 곤로 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동 곤로' LIMIT 1),
  false,
  NOW()
);

-- 6. 시청 더스팟팹 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '시청 더스팟팹' LIMIT 1),
  false,
  NOW()
);

-- 7. 동 방울과꼬막 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동 방울과꼬막' LIMIT 1),
  false,
  NOW()
);

-- 8. 문래 채윤희 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '문래 채윤희' LIMIT 1),
  false,
  NOW()
);

-- 9. 창신동 테르트르 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '창신동 테르트르' LIMIT 1),
  false,
  NOW()
);

-- 10. 오리올 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '오리올' LIMIT 1),
  false,
  NOW()
);

-- 11. 3가 대원식당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '3가 대원식당' LIMIT 1),
  false,
  NOW()
);

-- 12. 복덕방 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '복덕방' LIMIT 1),
  false,
  NOW()
);

-- 13. 연방 창화당 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '연방 창화당' LIMIT 1),
  false,
  NOW()
);

-- 14. 삼청동 기와탭룸 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '삼청동 기와탭룸' LIMIT 1),
  false,
  NOW()
);

-- 15. 동 양문 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동 양문' LIMIT 1),
  false,
  NOW()
);

-- 16. 하얀집 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '하얀집' LIMIT 1),
  false,
  NOW()
);

-- 17. 동 하니칼국수 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동 하니칼국수' LIMIT 1),
  false,
  NOW()
);

-- 18. 고센 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '고센' LIMIT 1),
  false,
  NOW()
);

-- 19. 보석 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '보석' LIMIT 1),
  false,
  NOW()
);

-- 20. 옥상달빛 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '옥상달빛' LIMIT 1),
  false,
  NOW()
);

-- 21. 동 갯벌의진주 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동 갯벌의진주' LIMIT 1),
  false,
  NOW()
);

-- 22. 안주마을 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '안주마을' LIMIT 1),
  false,
  NOW()
);

-- 23. 산울림1992 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '산울림1992' LIMIT 1),
  false,
  NOW()
);

-- 24. 도루묵 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '도루묵' LIMIT 1),
  false,
  NOW()
);

-- 25. 동 강가네 맷돌빈대떡 - 96026af8-edf8-4838-ab35-911acc26fde1
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
VALUES (
  '96026af8-edf8-4838-ab35-911acc26fde1',
  (SELECT id FROM places WHERE name = '동 강가네 맷돌빈대떡' LIMIT 1),
  false,
  NOW()
);
