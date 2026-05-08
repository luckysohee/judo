-- 큐레이터 장소 데이터 import (상호명 기반) - curator_id: 43b3eb72-a835-4b5b-b305-da4708b53b5c
-- 상호명으로 카카오지도 검색 성공한 장소들만 포함
-- place_id 포함하여 카카오 지도 정보 바로 표시 가능

-- 1. 만리199 (카카오 ID: 812076679)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '만리199', '서울 중구 만리동1가 62-19', 37.55546555457986, 126.96771163328161, '812076679', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '만리199');

-- 2. L7 강남 플로팅바 (카카오 ID: 1975224967)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT 'L7 강남 플로팅바', '서울 강남구 삼성동 142-41', 37.5057161987885, 127.051629346313, '1975224967', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = 'L7 강남 플로팅바');

-- 3. 히든아워 (카카오 ID: 1594335650)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '히든아워', '서울 종로구 종로5가 395-8', 37.5700931356741, 127.001313067983, '1594335650', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '히든아워');

-- 4. 히든아워 (카카오 ID: 1594335650)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '히든아워', '서울 종로구 종로5가 395-8', 37.5700931356741, 127.001313067983, '1594335650', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '히든아워');

-- 5. 효자바베 (카카오 ID: 26441783)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '효자바베', '서울 종로구 체부동 210-3', 37.5767531158103, 126.970104666408, '26441783', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '효자바베');

-- 6. 황소막창소금구이닭발 (카카오 ID: 1303797211)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '황소막창소금구이닭발', '대구 중구 삼덕동2가 143', 35.8667438343754, 128.600660417243, '1303797211', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '황소막창소금구이닭발');

-- 7. 황소막창 (카카오 ID: 1002644025)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '황소막창', '경북 김천시 신음동 1044-1', 36.13239915873, 128.1165669282, '1002644025', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '황소막창');

-- 8. 홍구포차 (카카오 ID: 1522008011)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '홍구포차', '서울 강북구 수유동 189-27', 37.641470645884, 127.024405623134, '1522008011', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '홍구포차');

-- 9. 혜성슈퍼 (카카오 ID: 462232535)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '혜성슈퍼', '서울 종로구 종로5가 95-1', 37.571331105319985, 127.00110933441542, '462232535', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '혜성슈퍼');

-- 10. 향촌식당 (카카오 ID: 12181934)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '향촌식당', '전남 순천시 동외동 168-1', 34.9588308780906, 127.485452077255, '12181934', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '향촌식당');

-- 11. 행오버 (카카오 ID: 1904612528)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '행오버', '서울 용산구 한남동 743-1', 37.5374806227197, 126.99973976374, '1904612528', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '행오버');

-- 12. 한신치킨호프 (카카오 ID: 8611462)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '한신치킨호프', '서울 서초구 잠원동 72-2', 37.5087818347685, 127.003565002416, '8611462', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '한신치킨호프');

-- 13. 한성돼 (카카오 ID: 1051522023)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '한성돼', '서울 성북구 동소문동2가 285', 37.58887758866426, 127.00944061354481, '1051522023', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '한성돼');

-- 14. 한포야장 (카카오 ID: 1980481031)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '한포야장', '서울 용산구 한남동 84-1', 37.532996146130394, 127.0068075991984, '1980481031', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '한포야장');

-- 15. 한남대교 (카카오 ID: 8132228)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '한남대교', '서울 강남구 신사동 490', 37.52702107996311, 127.01305185425754, '8132228', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '한남대교');

-- 16. 아리수만찬 (카카오 ID: 642933469)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '아리수만찬', '서울 영등포구 양화동 32-1', 37.5453291179695, 126.893676701713, '642933469', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '아리수만찬');

-- 17. 하영슈퍼 (카카오 ID: 14497402)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '하영슈퍼', '서울 종로구 종로5가 214-12', 37.5704931238017, 127.003798861823, '14497402', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '하영슈퍼');

-- 18. 하늘아래작은마을 (카카오 ID: 17809096)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '하늘아래작은마을', '서울 강북구 우이동 292-1', 37.674224679779385, 127.00450580223782, '17809096', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '하늘아래작은마을');

-- 19. 피플더테라스 (카카오 ID: 1958287649)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '피플더테라스', '서울 강남구 청담동 118-19', 37.5252985222721, 127.047552137652, '1958287649', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '피플더테라스');

-- 20. 피자빌스 (카카오 ID: 1341512562)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '피자빌스', '서울 마포구 망원동 430-24', 37.5580267507819, 126.898652040922, '1341512562', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '피자빌스');

-- 21. 포차용산스타일 (카카오 ID: 20348494)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '포차용산스타일', '서울 용산구 신계동 35-6', 37.53428511408006, 126.96245969340386, '20348494', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '포차용산스타일');

-- 22. 포석정 (카카오 ID: 8131696)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '포석정', '경북 경주시 배동 454-3', 35.8071925681957, 129.2128813439885, '8131696', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '포석정');

-- 23. 평원숯불갈비 (카카오 ID: 20743738)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '평원숯불갈비', '서울 종로구 효제동 174-6', 37.572197749404, 127.005288643309, '20743738', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '평원숯불갈비');

-- 24. 팔계집 연남 (카카오 ID: 920948664)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '팔계집 연남', '서울 마포구 연남동 227-34', 37.562634197624824, 126.92626387527702, '920948664', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '팔계집 연남');

-- 25. 트마리 (카카오 ID: 871897654)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '트마리', '서울 종로구 권농동 182-7', 37.574965423667, 126.991577704968, '871897654', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '트마리');

-- 26. 테라스59바베큐 (카카오 ID: 384726532)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '테라스59바베큐', '서울 광진구 구의동 201-8', 37.541587956279, 127.09494391008, '384726532', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '테라스59바베큐');

-- 27. 태태삼겹 신당2호점 (카카오 ID: 239871034)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '태태삼겹 신당2호점', '서울 중구 신당동 250-7', 37.565255859613, 127.013201139259, '239871034', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '태태삼겹 신당2호점');

-- 28. 태양곱창 본점 (카카오 ID: 377517929)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '태양곱창 본점', '서울 송파구 방이동 71-1', 37.5127548215588, 127.109713317976, '377517929', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '태양곱창 본점');

-- 29. 타르틴베이커리 한남점 (카카오 ID: 707576258)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '타르틴베이커리 한남점', '서울 용산구 한남동 263-2', 37.534394387317676, 127.00853652897942, '707576258', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '타르틴베이커리 한남점');

-- 30. 쿠촐로테라짜 (카카오 ID: 2093844452)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '쿠촐로테라짜', '서울 강남구 청담동 90-25', 37.52453918283249, 127.04227316650473, '2093844452', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '쿠촐로테라짜');

-- 31. 카페슬로우 (카카오 ID: 16733211)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '카페슬로우', '서울 서초구 서초동 1308-12', 37.50079626026492, 127.02535270032543, '16733211', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '카페슬로우');

-- 32. 카페브릭 (카카오 ID: 26932883)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '카페브릭', '서울 중랑구 신내동 243-20', 37.6178461752721, 127.108614809662, '26932883', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '카페브릭');

-- 33. 파툼 (카카오 ID: 8113742)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '파툼', '서울 종로구 삼청동 63-15', 37.583210275679, 126.982175371656, '8113742', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '파툼');

-- 34. 상국 (카카오 ID: 367830691)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '상국', '서울 종로구 원서동 134-10', 37.5795656775501, 126.988882792278, '367830691', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '상국');

-- 35. 카페브릭 (카카오 ID: 26932883)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '카페브릭', '서울 중랑구 신내동 243-20', 37.6178461752721, 127.108614809662, '26932883', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '카페브릭');

-- 36. 추억의길가포장마차 (카카오 ID: 18763532)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '추억의길가포장마차', '경기 고양시 일산서구 덕이동 309-3', 37.700143506462034, 126.75975222732384, '18763532', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '추억의길가포장마차');

-- 37. 청화가든 (카카오 ID: 15381112)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '청화가든', '서울 강북구 수유동 598', 37.6456933045111, 127.004219669737, '15381112', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청화가든');

-- 38. 청화가든 (카카오 ID: 15381112)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '청화가든', '서울 강북구 수유동 598', 37.6456933045111, 127.004219669737, '15381112', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청화가든');

-- 39. 청송산오징어 (카카오 ID: 11831516)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '청송산오징어', '서울 관악구 남현동 1065-1', 37.47577771739511, 126.97785289537023, '11831516', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청송산오징어');

-- 40. 청계천휴 (카카오 ID: 1334424022)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '청계천휴', '서울 종로구 관철동 32-7', 37.5687840073189, 126.985502172132, '1334424022', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '청계천휴');

-- 41. 창창 (카카오 ID: 632609162)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '창창', '서울 종로구 창신동 23-446', 37.578421433, 127.010925715869, '632609162', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '창창');

-- 42. 참새방앗간 (카카오 ID: 1144538874)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '참새방앗간', '서울 동대문구 청량리동 733', 37.5821754088401, 127.043942805721, '1144538874', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '참새방앗간');

-- 43. 찰랑 (카카오 ID: 392092883)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '찰랑', '울산 남구 달동 1266-5', 35.5361752268981, 129.331619242037, '392092883', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '찰랑');

-- 44. 진짜사나이 을지로통큰골뱅이 본점 (카카오 ID: 24752065)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '진짜사나이 을지로통큰골뱅이 본점', '서울 영등포구 문래동4가 4-3', 37.5154720829091, 126.892063101465, '24752065', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '진짜사나이 을지로통큰골뱅이 본점');

-- 45. 진영이네 (카카오 ID: 21407873)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '진영이네', '서울 종로구 장사동 109-1', 37.569779482934, 126.994820194923, '21407873', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '진영이네');

-- 46. 지지타운 (카카오 ID: 1142653090)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '지지타운', '서울 중구 을지로3가 349-1', 37.5657706406008, 126.989972588736, '1142653090', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '지지타운');

-- 47. 지오짱조개구이 (카카오 ID: 8086735)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '지오짱조개구이', '서울 서대문구 창천동 57-19', 37.5571914144927, 126.935752253744, '8086735', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '지오짱조개구이');

-- 48. 죠야 서울 (카카오 ID: 427978985)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '죠야 서울', '서울 강남구 논현동 82-20', 37.5154061577152, 127.032310689425, '427978985', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '죠야 서울');

-- 49. 종삼육 (카카오 ID: 336754481)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '종삼육', '서울 종로구 돈의동 51', 37.57277686163228, 126.99096101374309, '336754481', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '종삼육');

-- 50. 화신맛의거리 (카카오 ID: 17727357)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '화신맛의거리', '서울 종로구 인사동 194-13', 37.57172481565081, 126.98517559189975, '17727357', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '화신맛의거리');

-- 51. 화신맛의거리 (카카오 ID: 17727357)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '화신맛의거리', '서울 종로구 인사동 194-13', 37.57172481565081, 126.98517559189975, '17727357', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '화신맛의거리');

-- 52. 조선부뚜막 정릉점 (카카오 ID: 2127170123)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '조선부뚜막 정릉점', '서울 성북구 정릉동 388-6', 37.6081813642149, 127.008896039848, '2127170123', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '조선부뚜막 정릉점');

-- 53. 정통호프 (카카오 ID: 16625564)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '정통호프', '서울 중구 정동 2-1', 37.5686490436451, 126.975672489634, '16625564', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '정통호프');

-- 54. 전주집 (카카오 ID: 9934552)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '전주집', '서울 종로구 종로5가 281-9', 37.57025875375017, 127.00637971338996, '9934552', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '전주집');

-- 55. 카페윤 (카카오 ID: 760104114)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '카페윤', '부산 기장군 기장읍 시랑리 631', 35.181870628546, 129.211330659291, '760104114', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '카페윤');

-- 56. 갓잇 안국점 (카카오 ID: 150094462)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '갓잇 안국점', '서울 종로구 재동 84-30', 37.5781841403341, 126.985944124174, '150094462', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '갓잇 안국점');

-- 57. 잠실나그네 (카카오 ID: 8508283)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '잠실나그네', '서울 송파구 잠실동 206-20', 37.50987788773497, 127.08454562240897, '8508283', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '잠실나그네');

-- 58. 일점사 교대본점 (카카오 ID: 944211682)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '일점사 교대본점', '서울 서초구 서초동 1569-15', 37.49133767595, 127.0131711577, '944211682', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '일점사 교대본점');

-- 59. 일번지 (카카오 ID: 25343220)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '일번지', '경북 성주군 용암면 문명리', 35.8627911322428, 128.358047941314, '25343220', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '일번지');

-- 60. 인디아나호프 (카카오 ID: 21332315)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '인디아나호프', '서울 강남구 청담동 23', 37.5213423180753, 127.039995351841, '21332315', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '인디아나호프');

-- 61. 익선동야장 (카카오 ID: 184605732)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '익선동야장', '서울 종로구 낙원동 132-2', 37.572389319259734, 126.98957210896731, '184605732', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '익선동야장');

-- 62. 이태원 실비디스코 (카카오 ID: 1136118574)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '이태원 실비디스코', '서울 용산구 이태원동 136-46', 37.53373689783812, 126.99601179582436, '1136118574', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이태원 실비디스코');

-- 63. 이태원실비 (카카오 ID: 270858823)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '이태원실비', '서울 용산구 이태원동 130-29', 37.5332187283326, 126.993828226027, '270858823', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이태원실비');

-- 64. 달맥슈퍼 (카카오 ID: 795389291)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '달맥슈퍼', '서울 용산구 이태원동 704', 37.53938469243458, 126.98765656719875, '795389291', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '달맥슈퍼');

-- 65. 이수노가리 앤 전기통닭 (카카오 ID: 2049911670)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '이수노가리 앤 전기통닭', '서울 서초구 방배동 867-28', 37.4861045554897, 126.986241803988, '2049911670', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이수노가리 앤 전기통닭');

-- 66. 이모네생고기 (카카오 ID: 16035564)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '이모네생고기', '서울 중구 신당동 250-31', 37.56529635986181, 127.01359390965546, '16035564', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이모네생고기');

-- 67. 이가네식품 (카카오 ID: 1223329967)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '이가네식품', '서울 중구 인현동1가 132-3', 37.5631228682618, 126.99366164175, '1223329967', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '이가네식품');

-- 68. 을지상회 (카카오 ID: 1069262475)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '을지상회', '서울 중구 을지로3가 320-8', 37.5654022333122, 126.99123016143, '1069262475', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '을지상회');

-- 69. 화신맛의거리 (카카오 ID: 17727357)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '화신맛의거리', '서울 종로구 인사동 194-13', 37.57172481565081, 126.98517559189975, '17727357', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '화신맛의거리');

-- 70. 모아식품 (카카오 ID: 1483201446)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '모아식품', '서울 중구 인현동2가 96-15', 37.564582541655284, 126.9948839395933, '1483201446', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '모아식품');

-- 71. 은하수참치 (카카오 ID: 1477412866)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '은하수참치', '경기 안양시 동안구 관양동 1489-14', 37.40134168191223, 126.9756069611229, '1477412866', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '은하수참치');

-- 72. 육값하네 (카카오 ID: 14745028)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '육값하네', '제주특별자치도 서귀포시 남원읍 의귀리 1177-3', 33.2922833217823, 126.721961727652, '14745028', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '육값하네');

-- 73. 육각고기 (카카오 ID: 22135375)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '육각고기', '서울 서초구 반포동 19-4', 37.5060173976552, 127.007003071366, '22135375', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '육각고기');

-- 74. 원조만선호프 노가리체인본점 (카카오 ID: 8332362)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '원조만선호프 노가리체인본점', '서울 중구 을지로3가 95-1', 37.56724931479237, 126.99178231800013, '8332362', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '원조만선호프 노가리체인본점');

-- 75. 우야재 (카카오 ID: 33250400)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '우야재', '서울 중구 신당동 368-21', 37.553438747465, 127.009384083048, '33250400', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '우야재');

-- 76. 우리슈퍼 (카카오 ID: 16529025)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '우리슈퍼', '서울 용산구 이태원동 671', 37.53859266194441, 126.98717468779111, '16529025', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '우리슈퍼');

-- 77. 우리맛곱창 (카카오 ID: 1612658666)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '우리맛곱창', '서울 성북구 정릉동 388-1', 37.6084642800342, 127.00882812135951, '1612658666', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '우리맛곱창');

-- 78. 용산봉숭아 (카카오 ID: 1107895548)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '용산봉숭아', '서울 용산구 한강로3가 40-128', 37.5261692355007, 126.963553194003, '1107895548', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '용산봉숭아');

-- 79. 용마쉼터 (카카오 ID: 16996212)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '용마쉼터', '서울 중랑구 망우동 산 69-1', 37.59461181393687, 127.10523953704342, '16996212', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '용마쉼터');

-- 80. 왕십리주먹고기 (카카오 ID: 21333052)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '왕십리주먹고기', '서울 성동구 행당동 309-63', 37.5595287618995, 127.033333635238, '21333052', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '왕십리주먹고기');

-- 81. 와인에빠진저팔계 (카카오 ID: 9950732)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '와인에빠진저팔계', '서울 송파구 잠실동 186-3', 37.510034980486, 127.084100166967, '9950732', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '와인에빠진저팔계');

-- 82. 와이키키 (카카오 ID: 1199915203)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '와이키키', '서울 용산구 이태원동 273-20', 37.53910184618186, 126.98832305936736, '1199915203', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '와이키키');

-- 83. 올드빅 (카카오 ID: 265733398)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '올드빅', '서울 용산구 용산동2가 1-489', 37.54521385372382, 126.9850088431997, '265733398', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '올드빅');

-- 84. 온달집 강남역점 (카카오 ID: 781530845)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '온달집 강남역점', '서울 서초구 서초동 1307-19', 37.5001258792062, 127.025504014011, '781530845', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '온달집 강남역점');

-- 85. 옥상별관 (카카오 ID: 405758413)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '옥상별관', '서울 종로구 관수동 19', 37.5695448863891, 126.989676644648, '405758413', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '옥상별관');

-- 86. 옥상맥주 (카카오 ID: 1158209388)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '옥상맥주', '경기 평택시 동삭동 711-14', 37.0096385955158, 127.09892085112, '1158209388', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '옥상맥주');

-- 87. 옥상 (카카오 ID: 1956265515)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '옥상', '서울 마포구 서교동 401-17', 37.5484983644216, 126.9192481275, '1956265515', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '옥상');

-- 88. 오징어잡는남자 잠실점 (카카오 ID: 615068275)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '오징어잡는남자 잠실점', '서울 송파구 잠실동 190-6', 37.5097696650439, 127.082136378165, '615068275', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '오징어잡는남자 잠실점');

-- 89. 오뚜기식품 (카카오 ID: 16445071)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '오뚜기식품', '서울 성동구 성수동2가 278-51', 37.54607896717668, 127.05994042247526, '16445071', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '오뚜기식품');

-- 90. 오뚜기식품 (카카오 ID: 16445071)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '오뚜기식품', '서울 성동구 성수동2가 278-51', 37.54607896717668, 127.05994042247526, '16445071', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '오뚜기식품');

-- 91. 오늘밤에포차 (카카오 ID: 1797095095)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '오늘밤에포차', '서울 강남구 논현동 166-7', 37.50819539882559, 127.02496726270263, '1797095095', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '오늘밤에포차');

-- 92. 염리포장마차거리 (카카오 ID: 1958929930)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '염리포장마차거리', '서울 마포구 염리동 169', 37.5419643145171, 126.946105239865, '1958929930', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '염리포장마차거리');

-- 93. 연탄공장 (카카오 ID: 7997364)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '연탄공장', '서울 강남구 신사동 642-19', 37.5262485002626, 127.036522641143, '7997364', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '연탄공장');

-- 94. 연탄공장 (카카오 ID: 20026614)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '연탄공장', '부산 사하구 다대동 1582-15', 35.059646491251414, 128.98116016505764, '20026614', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '연탄공장');

-- 95. 역촌호프와노가리 (카카오 ID: 929028146)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '역촌호프와노가리', '서울 은평구 역촌동 27-13', 37.60426337088127, 126.92158193240523, '929028146', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '역촌호프와노가리');

-- 96. 여수집 (카카오 ID: 10653723)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '여수집', '서울 강동구 고덕동 512', 37.5616029969299, 127.1564636719, '10653723', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '여수집');

-- 97. 에이스호프 (카카오 ID: 856102567)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '에이스호프', '서울 중구 을지로3가 95-6', 37.567004230532, 126.991592184311, '856102567', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '에이스호프');

-- 98. 어시장 (카카오 ID: 1093324106)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '어시장', '전북특별자치도 전주시 완산구 다가동3가 53-5', 35.8180850140846, 127.139235956334, '1093324106', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '어시장');

-- 99. 어나더레벨 (카카오 ID: 244794984)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '어나더레벨', '서울 중구 을지로3가 320', 37.5656491085916, 126.99126182535, '244794984', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '어나더레벨');

-- 100. 야젠 2호점 (카카오 ID: 1534550447)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '야젠 2호점', '서울 종로구 돈의동 125-1', 37.5716461486747, 126.991442241328, '1534550447', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '야젠 2호점');

-- 101. 야장집 (카카오 ID: 1434987994)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '야장집', '서울 관악구 봉천동 1634-8', 37.47552690897514, 126.9652622867107, '1434987994', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '야장집');

-- 102. 애주옥 (카카오 ID: 1892501054)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '애주옥', '서울 용산구 한남동 641-10', 37.5327727741479, 127.005322062678, '1892501054', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '애주옥');

-- 103. 압구정닭꼬치 (카카오 ID: 15719300)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '압구정닭꼬치', '서울 동대문구 휘경동 319-16', 37.58980429813852, 127.05625035704402, '15719300', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '압구정닭꼬치');

-- 104. 아주맛있는빠베큐 (카카오 ID: 911727809)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '아주맛있는빠베큐', '서울 성북구 정릉동 388-5', 37.60827056439712, 127.00886660460182, '911727809', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '아주맛있는빠베큐');

-- 105. 아미고프란고 건대점 (카카오 ID: 1816055329)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '아미고프란고 건대점', '서울 광진구 화양동 111-100', 37.545538738558385, 127.07362309855473, '1816055329', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '아미고프란고 건대점');

-- 106. 아리수만찬 (카카오 ID: 642933469)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '아리수만찬', '서울 영등포구 양화동 32-1', 37.5453291179695, 126.893676701713, '642933469', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '아리수만찬');

-- 107. 아노브피자 이태원 (카카오 ID: 26781910)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '아노브피자 이태원', '서울 용산구 이태원동 74-34', 37.533725009249764, 126.99242524178638, '26781910', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '아노브피자 이태원');

-- 108. 싱싱소한마리 (카카오 ID: 1339849959)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '싱싱소한마리', '서울 성북구 동소문동2가 153', 37.5885397542294, 127.00895597453, '1339849959', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '싱싱소한마리');

-- 109. 신천포차 (카카오 ID: 7980341)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '신천포차', '서울 송파구 잠실동 208-6', 37.5092806690364, 127.085592288053, '7980341', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신천포차');

-- 110. 신진슈퍼 (카카오 ID: 920440071)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '신진슈퍼', '서울 종로구 종로5가 225-10', 37.570374169805, 127.004446336564, '920440071', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '신진슈퍼');

-- 111. 태태삼겹 신당2호점 (카카오 ID: 239871034)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '태태삼겹 신당2호점', '서울 중구 신당동 250-7', 37.565255859613, 127.013201139259, '239871034', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '태태삼겹 신당2호점');

-- 112. 시즌모먼트 (카카오 ID: 337970195)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '시즌모먼트', '서울 중랑구 상봉동 115-27', 37.5955685969817, 127.083968735017, '337970195', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '시즌모먼트');

-- 113. 카페스페이스530 (카카오 ID: 334882918)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '카페스페이스530', '서울 양천구 목동 530-5', 37.5463127694482, 126.871672574189, '334882918', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '카페스페이스530');

-- 114. 아이술래 (카카오 ID: 20537317)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '아이술래', '서울 마포구 용강동 472-3', 37.5426299332467, 126.940041971184, '20537317', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '아이술래');

-- 115. 성북동막걸리 (카카오 ID: 12333162)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '성북동막걸리', '서울 성북구 동소문동2가 137', 37.5879037340656, 127.007821409057, '12333162', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '성북동막걸리');

-- 116. 서촌주점 (카카오 ID: 1577342619)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '서촌주점', '서울 종로구 누하동 31', 37.57988654548199, 126.96921810876866, '1577342619', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서촌주점');

-- 117. 스태픽스 (카카오 ID: 1508329235)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '스태픽스', '서울 종로구 필운동 32-1', 37.5774769385374, 126.967908167278, '1508329235', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '스태픽스');

-- 118. 서초옥상 (카카오 ID: 477661805)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '서초옥상', '서울 서초구 서초동 1554-4', 37.4924551725244, 127.010724340725, '477661805', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서초옥상');

-- 119. 서울식품 (카카오 ID: 15434055)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '서울식품', '서울 종로구 관수동 102-2', 37.56884402967113, 126.99112561977735, '15434055', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서울식품');

-- 120. 서아진 루프탑송리단길점 (카카오 ID: 1926262880)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '서아진 루프탑송리단길점', '서울 송파구 송파동 36-6', 37.5092678325058, 127.107869150481, '1926262880', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서아진 루프탑송리단길점');

-- 121. 서문객잔 (카카오 ID: 1720697728)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '서문객잔', '서울 서대문구 충정로2가 78-14', 37.5653162974913, 126.965054248723, '1720697728', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '서문객잔');

-- 122. 상수주택 (카카오 ID: 904914651)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '상수주택', '서울 마포구 상수동 311-1', 37.5486515566708, 126.921961612301, '904914651', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '상수주택');

-- 123. 상수주택 (카카오 ID: 904914651)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '상수주택', '서울 마포구 상수동 311-1', 37.5486515566708, 126.921961612301, '904914651', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '상수주택');

-- 124. 삼천리골 돼지집 (카카오 ID: 26493049)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '삼천리골 돼지집', '서울 은평구 진관동 산 30-3', 37.64330440890593, 126.94257172859562, '26493049', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '삼천리골 돼지집');

-- 125. 삼미정 (카카오 ID: 16708708)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '삼미정', '서울 중구 산림동 207-2', 37.567333308865656, 126.99553233783833, '16708708', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '삼미정');

-- 126. SOUND CLASKA (카카오 ID: 322343440)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT 'SOUND CLASKA', '서울 성동구 성수동2가 273-13', 37.54264640752836, 127.05945111213201, '322343440', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = 'SOUND CLASKA');

-- 127. 사당동부산오뎅 (카카오 ID: 11831452)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '사당동부산오뎅', '서울 관악구 남현동 602-42', 37.475087031297576, 126.98003274309684, '11831452', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '사당동부산오뎅');

-- 128. 빈야드15 (카카오 ID: 2080075889)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '빈야드15', '서울 강서구 마곡동 766-1', 37.5669732015523, 126.829421538138, '2080075889', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '빈야드15');

-- 129. 비틀스타코 (카카오 ID: 832632653)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '비틀스타코', '제주특별자치도 제주시 애월읍 애월리 2527-3', 33.4632637628383, 126.309728256428, '832632653', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '비틀스타코');

-- 130. BBQ 빌리지 호텔더보타닉세운명동점 (카카오 ID: 1565008842)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT 'BBQ 빌리지 호텔더보타닉세운명동점', '서울 중구 입정동 281', 37.567543190147, 126.994348340573, '1565008842', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = 'BBQ 빌리지 호텔더보타닉세운명동점');

-- 131. 불꽃여자 (카카오 ID: 840850082)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '불꽃여자', '서울 용산구 한남동 632-8', 37.5328060947536, 127.005675059155, '840850082', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '불꽃여자');

-- 132. 북한산인수재 (카카오 ID: 1556826180)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '북한산인수재', '서울 강북구 수유동 535-55', 37.6442300833029, 127.00482691741877, '1556826180', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '북한산인수재');

-- 133. 부산집 (카카오 ID: 21410648)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '부산집', '서울 마포구 동교동 206-1', 37.5565729193285, 126.920297601582, '21410648', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '부산집');

-- 134. 봉구비어 오목교역점 (카카오 ID: 24634621)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '봉구비어 오목교역점', '서울 양천구 목동 404-16', 37.52349461510561, 126.87730230531716, '24634621', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '봉구비어 오목교역점');

-- 135. 백만불식품 (카카오 ID: 530101305)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '백만불식품', '서울 중구 을지로4가 183-3', 37.5660260408054, 126.998668893112, '530101305', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '백만불식품');

-- 136. 배고픈돼지 (카카오 ID: 734668329)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '배고픈돼지', '서울 송파구 잠실동 191-6', 37.510126852825, 127.081573507313, '734668329', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '배고픈돼지');

-- 137. 방울과꼬막 (카카오 ID: 175302923)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '방울과꼬막', '서울 용산구 한남동 632-10', 37.532679949778, 127.005774611871, '175302923', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방울과꼬막');

-- 138. 방방 (카카오 ID: 1215578619)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '방방', '서울 용산구 용산동2가 1-684', 37.54497597956411, 126.98492741741414, '1215578619', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방방');

-- 139. 방목 (카카오 ID: 1965759429)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '방목', '서울 성북구 동소문동2가 132', 37.587964115070235, 127.00759949913108, '1965759429', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '방목');

-- 140. 밥도사술도사 (카카오 ID: 659207783)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '밥도사술도사', '서울 종로구 낙원동 233', 37.57215044259079, 126.9883631809173, '659207783', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '밥도사술도사');

-- 141. 반원칼국수 (카카오 ID: 16054329)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '반원칼국수', '서울 서초구 잠원동 72-2', 37.5087854393324, 127.003546906127, '16054329', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '반원칼국수');

-- 142. 미진숯불막창 (카카오 ID: 1489368800)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '미진숯불막창', '서울 종로구 청진동 179-1', 37.57174653008338, 126.97972397111201, '1489368800', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '미진숯불막창');

-- 143. 미갈매기살 (카카오 ID: 289535795)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '미갈매기살', '서울 종로구 묘동 164', 37.572869686283, 126.99125532179, '289535795', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '미갈매기살');

-- 144. 뮌헨호프 (카카오 ID: 1626559942)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '뮌헨호프', '서울 중구 초동 21-2', 37.564897729978, 126.991997632865, '1626559942', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '뮌헨호프');

-- 145. 문화식당 (카카오 ID: 1452193831)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '문화식당', '서울 성동구 성수동2가 310-21', 37.5423013181902, 127.053829373707, '1452193831', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '문화식당');

-- 146. 문래옥상 (카카오 ID: 478117977)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '문래옥상', '서울 영등포구 문래동3가 58-20', 37.51482445124475, 126.8942651924607, '478117977', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '문래옥상');

-- 147. 무채색 (카카오 ID: 1566558458)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '무채색', '서울 마포구 동교동 113-24', 37.56058144382453, 126.92581091027769, '1566558458', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '무채색');

-- 148. 모아식품 (카카오 ID: 1483201446)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '모아식품', '서울 중구 인현동2가 96-15', 37.564582541655284, 126.9948839395933, '1483201446', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '모아식품');

-- 149. 명동골뱅이 (카카오 ID: 18757975)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '명동골뱅이', '서울 중구 을지로3가 95-6', 37.5669501781499, 126.991696325885, '18757975', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '명동골뱅이');

-- 150. 메종드쌍문 (카카오 ID: 90926338)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '메종드쌍문', '서울 도봉구 쌍문동 628', 37.6571933823998, 127.039011898396, '90926338', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '메종드쌍문');

-- 151. 메이게츠 군자 (카카오 ID: 1536072723)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '메이게츠 군자', '서울 광진구 군자동 476-10', 37.5558894478948, 127.077773185523, '1536072723', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '메이게츠 군자');

-- 152. 멍석집 (카카오 ID: 10351528)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '멍석집', '충북 괴산군 칠성면 두천리 139-3', 36.7911773731357, 127.839635394283, '10351528', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '멍석집');

-- 153. 먹거리장터2 (카카오 ID: 16704633)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '먹거리장터2', '서울 성동구 행당동 293-2', 37.55980263036762, 127.03345599158146, '16704633', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '먹거리장터2');

-- 154. 먹거리장터 (카카오 ID: 16653451)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '먹거리장터', '대전 대덕구 목상동 156-3', 36.44721291932103, 127.4122546842708, '16653451', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '먹거리장터');

-- 155. 매일호프 (카카오 ID: 18567499)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '매일호프', '서울 중구 을지로2가 101-27', 37.566676055503606, 126.98900582182826, '18567499', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '매일호프');

-- 156. 원조만선호프 노가리체인본점 (카카오 ID: 8332362)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '원조만선호프 노가리체인본점', '서울 중구 을지로3가 95-1', 37.56724931479237, 126.99178231800013, '8332362', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '원조만선호프 노가리체인본점');

-- 157. 만리재비스트로 (카카오 ID: 1646052453)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '만리재비스트로', '서울 중구 만리동1가 62-11', 37.5556079449278, 126.967831535859, '1646052453', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '만리재비스트로');

-- 158. 마포주먹고기 고척돔점 (카카오 ID: 52856890)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '마포주먹고기 고척돔점', '서울 구로구 고척동 52-240', 37.5013010642808, 126.865681158266, '52856890', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마포주먹고기 고척돔점');

-- 159. 마포 껍데기 (카카오 ID: 10342082)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '마포 껍데기', '서울 동대문구 장안동 100-8', 37.578927571383, 127.06965063221, '10342082', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마포 껍데기');

-- 160. 마당족발 (카카오 ID: 7866034)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '마당족발', '서울 광진구 화양동 111-119', 37.5462443878874, 127.073354473115, '7866034', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '마당족발');

-- 161. 리제로 서울 (카카오 ID: 1398571605)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '리제로 서울', '서울 종로구 신문로2가 1-348', 37.5729539965698, 126.968095755928, '1398571605', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '리제로 서울');

-- 162. 르스타일바 (카카오 ID: 27072801)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '르스타일바', '서울 중구 충무로2가 53-10', 37.5616233039812, 126.989397044657, '27072801', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '르스타일바');

-- 163. 루프탑스테이 (카카오 ID: 1369127798)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '루프탑스테이', '서울 용산구 남영동 35-2', 37.5437485345888, 126.973170790419, '1369127798', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '루프탑스테이');

-- 164. 루프탑 피자펍 (카카오 ID: 1872752229)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '루프탑 피자펍', '서울 은평구 역촌동 70-40', 37.604026455939, 126.910263155249, '1872752229', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '루프탑 피자펍');

-- 165. 루프탑어반비치 (카카오 ID: 1424950736)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '루프탑어반비치', '서울 마포구 서교동 403-4', 37.54989781700859, 126.92060912359968, '1424950736', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '루프탑어반비치');

-- 166. 루프탑스테이 (카카오 ID: 1369127798)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '루프탑스테이', '서울 용산구 남영동 35-2', 37.5437485345888, 126.973170790419, '1369127798', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '루프탑스테이');

-- 167. 루프808 (카카오 ID: 561053021)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '루프808', '서울 강남구 역삼동 808', 37.504339079125394, 127.02505080057104, '561053021', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '루프808');

-- 168. 랜돌프비어 마곡나루 (카카오 ID: 1272392964)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '랜돌프비어 마곡나루', '서울 강서구 마곡동 738-3', 37.568313468085684, 126.82483191401953, '1272392964', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '랜돌프비어 마곡나루');

-- 169. 뚝도지기 (카카오 ID: 38620260)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '뚝도지기', '서울 성동구 성수동2가 335-36', 37.5378040702262, 127.05460798425395, '38620260', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '뚝도지기');

-- 170. 뚝도지기 (카카오 ID: 38620260)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '뚝도지기', '서울 성동구 성수동2가 335-36', 37.5378040702262, 127.05460798425395, '38620260', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '뚝도지기');

-- 171. 뚝도지기 (카카오 ID: 38620260)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '뚝도지기', '서울 성동구 성수동2가 335-36', 37.5378040702262, 127.05460798425395, '38620260', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '뚝도지기');

-- 172. 디자이너리카페 (카카오 ID: 1099251112)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '디자이너리카페', '서울 관악구 신림동 1465-12', 37.485044830857, 126.92412069161948, '1099251112', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '디자이너리카페');

-- 173. 동해남부선 서촌본점 (카카오 ID: 21056157)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '동해남부선 서촌본점', '서울 종로구 내자동 11-1', 37.576395762477766, 126.97148477885403, '21056157', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동해남부선 서촌본점');

-- 174. 동해골뱅이 (카카오 ID: 524675225)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '동해골뱅이', '인천 남동구 논현동 624-4', 37.4024736243132, 126.72246345802, '524675225', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동해골뱅이');

-- 175. 동백상회 (카카오 ID: 340372135)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '동백상회', '서울 마포구 동교동 149-2', 37.56062034503681, 126.924638314908, '340372135', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동백상회');

-- 176. 동백상회 (카카오 ID: 340372135)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '동백상회', '서울 마포구 동교동 149-2', 37.56062034503681, 126.924638314908, '340372135', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동백상회');

-- 177. 조일식품 (카카오 ID: 8573461)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '조일식품', '서울 중구 을지로5가 79-1', 37.5660998751199, 127.00359942524, '8573461', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '조일식품');

-- 178. 동남옥탑 (카카오 ID: 1685423348)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '동남옥탑', '서울 영등포구 문래동2가 20-3', 37.512935117892, 126.894344772022, '1685423348', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '동남옥탑');

-- 179. 도시섬 (카카오 ID: 858019265)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '도시섬', '서울 용산구 이태원동 129-10', 37.5332637610995, 126.993505773803, '858019265', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '도시섬');

-- 180. 도봉산양고기 (카카오 ID: 16534078)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '도봉산양고기', '서울 도봉구 도봉동 343-2', 37.6898881016631, 127.041718329646, '16534078', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '도봉산양고기');

-- 181. 더백테라스 신용산점 (카카오 ID: 229094588)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '더백테라스 신용산점', '서울 용산구 한강로2가 147', 37.530005873331625, 126.97063922895882, '229094588', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '더백테라스 신용산점');

-- 182. 대파곱창 (카카오 ID: 37972321)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '대파곱창', '서울 성북구 동소문동5가 119-2', 37.59108882886546, 127.01591975931612, '37972321', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대파곱창');

-- 183. 대원식당 (카카오 ID: 16329490)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '대원식당', '서울 용산구 용산동3가 1-64', 37.5343244149508, 126.974719678743, '16329490', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대원식당');

-- 184. 대성골뱅이 (카카오 ID: 16875294)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '대성골뱅이', '서울 중구 무교동 10-2', 37.56827047127497, 126.97961624834933, '16875294', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대성골뱅이');

-- 185. 대림호프커피 (카카오 ID: 16476912)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '대림호프커피', '서울 영등포구 대림동 1057-21', 37.4923824536696, 126.897605501259, '16476912', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대림호프커피');

-- 186. 대나무집 (카카오 ID: 1182689945)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '대나무집', '부산 중구 중앙동3가 13-8', 35.103571694662, 129.035083735661, '1182689945', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '대나무집');

-- 187. 당인동국수공장 (카카오 ID: 128475361)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '당인동국수공장', '서울 마포구 당인동 25-9', 37.5458059879061, 126.92029096074712, '128475361', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '당인동국수공장');

-- 188. 달사막 (카카오 ID: 893994670)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '달사막', '제주특별자치도 제주시 조천읍 함덕리 272-28', 33.54190172816611, 126.67248415048759, '893994670', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '달사막');

-- 189. 달빛야장 (카카오 ID: 330546486)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '달빛야장', '서울 중구 태평로1가 61-1', 37.5684366101967, 126.97667092104, '330546486', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '달빛야장');

-- 190. 달맞이광장바베큐 (카카오 ID: 377327523)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '달맞이광장바베큐', '서울 중구 을지로3가 343-11', 37.565847266782, 126.990474006135, '377327523', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '달맞이광장바베큐');

-- 191. 달막달막 (카카오 ID: 1230183870)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '달막달막', '서울 종로구 관훈동 118-20', 37.5752205457894, 126.984174181996, '1230183870', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '달막달막');

-- 192. 달 루프탑 (카카오 ID: 1455581025)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '달 루프탑', '서울 노원구 공릉동 386-2', 37.6261261840564, 127.073709307398, '1455581025', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '달 루프탑');

-- 193. 다트플렉스 강남점 (카카오 ID: 1047545360)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '다트플렉스 강남점', '서울 강남구 논현동 164-14', 37.5079433954265, 127.023615614641, '1047545360', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '다트플렉스 강남점');

-- 194. 다운이네 (카카오 ID: 422202306)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '다운이네', '서울 중랑구 중화동 73-7', 37.5950293722299, 127.076658922909, '422202306', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '다운이네');

-- 195. 을지다락 (카카오 ID: 378913911)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '을지다락', '서울 중구 초동 156-9', 37.56374441420448, 126.99142050809589, '378913911', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '을지다락');

-- 196. 다락 오금역점 (카카오 ID: 1722977029)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '다락 오금역점', '서울 송파구 가락동 16-18', 37.5004102526538, 127.12503254353, '1722977029', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '다락 오금역점');

-- 197. 다동황소막창 (카카오 ID: 129517930)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '다동황소막창', '서울 중구 명동2가 94-1', 37.5626621896615, 126.98220856438, '129517930', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '다동황소막창');

-- 198. 누이트 (카카오 ID: 2134743430)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '누이트', '서울 종로구 익선동 154-3', 37.5738877545295, 126.990529582681, '2134743430', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '누이트');

-- 199. 누룩나무 (카카오 ID: 22875062)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '누룩나무', '서울 종로구 관훈동 118-19', 37.5752637892758, 126.984142475909, '22875062', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '누룩나무');

-- 200. 넬보스코 루프탑라운지&바 (카카오 ID: 276115251)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '넬보스코 루프탑라운지&바', '서울 중구 회현동1가 194-23', 37.5587181207682, 126.979693548499, '276115251', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '넬보스코 루프탑라운지&바');

-- 201. 넬보스코 루프탑라운지&바 (카카오 ID: 276115251)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '넬보스코 루프탑라운지&바', '서울 중구 회현동1가 194-23', 37.5587181207682, 126.979693548499, '276115251', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '넬보스코 루프탑라운지&바');

-- 202. 낙성아주 (카카오 ID: 2107850807)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '낙성아주', '서울 관악구 봉천동 1620-33', 37.4778518930148, 126.958096837209, '2107850807', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '낙성아주');

-- 203. 낙산공원 (카카오 ID: 8253524)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '낙산공원', '서울 종로구 동숭동 산 2-10', 37.58056966858, 127.007521763748, '8253524', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '낙산공원');

-- 204. 나누리잡화점 (카카오 ID: 165787715)
INSERT INTO places (name, address, lat, lng, place_id, created_at) 
SELECT '나누리잡화점', '서울 성동구 성수동2가 315-55', 37.542863137107425, 127.05471011825232, '165787715', NOW()
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = '나누리잡화점');

-- Curator_Place 관계 추가
INSERT INTO curator_places (curator_id, place_id, is_archived, created_at)
SELECT '43b3eb72-a835-4b5b-b305-da4708b53b5c', id, false, NOW()
FROM places 
WHERE name IN (
  '만리199',
  'L7 강남 플로팅바',
  '히든아워',
  '히든아워',
  '효자바베',
  '황소막창소금구이닭발',
  '황소막창',
  '홍구포차',
  '혜성슈퍼',
  '향촌식당',
  '행오버',
  '한신치킨호프',
  '한성돼',
  '한포야장',
  '한남대교',
  '아리수만찬',
  '하영슈퍼',
  '하늘아래작은마을',
  '피플더테라스',
  '피자빌스',
  '포차용산스타일',
  '포석정',
  '평원숯불갈비',
  '팔계집 연남',
  '트마리',
  '테라스59바베큐',
  '태태삼겹 신당2호점',
  '태양곱창 본점',
  '타르틴베이커리 한남점',
  '쿠촐로테라짜',
  '카페슬로우',
  '카페브릭',
  '파툼',
  '상국',
  '카페브릭',
  '추억의길가포장마차',
  '청화가든',
  '청화가든',
  '청송산오징어',
  '청계천휴',
  '창창',
  '참새방앗간',
  '찰랑',
  '진짜사나이 을지로통큰골뱅이 본점',
  '진영이네',
  '지지타운',
  '지오짱조개구이',
  '죠야 서울',
  '종삼육',
  '화신맛의거리',
  '화신맛의거리',
  '조선부뚜막 정릉점',
  '정통호프',
  '전주집',
  '카페윤',
  '갓잇 안국점',
  '잠실나그네',
  '일점사 교대본점',
  '일번지',
  '인디아나호프',
  '익선동야장',
  '이태원 실비디스코',
  '이태원실비',
  '달맥슈퍼',
  '이수노가리 앤 전기통닭',
  '이모네생고기',
  '이가네식품',
  '을지상회',
  '화신맛의거리',
  '모아식품',
  '은하수참치',
  '육값하네',
  '육각고기',
  '원조만선호프 노가리체인본점',
  '우야재',
  '우리슈퍼',
  '우리맛곱창',
  '용산봉숭아',
  '용마쉼터',
  '왕십리주먹고기',
  '와인에빠진저팔계',
  '와이키키',
  '올드빅',
  '온달집 강남역점',
  '옥상별관',
  '옥상맥주',
  '옥상',
  '오징어잡는남자 잠실점',
  '오뚜기식품',
  '오뚜기식품',
  '오늘밤에포차',
  '염리포장마차거리',
  '연탄공장',
  '연탄공장',
  '역촌호프와노가리',
  '여수집',
  '에이스호프',
  '어시장',
  '어나더레벨',
  '야젠 2호점',
  '야장집',
  '애주옥',
  '압구정닭꼬치',
  '아주맛있는빠베큐',
  '아미고프란고 건대점',
  '아리수만찬',
  '아노브피자 이태원',
  '싱싱소한마리',
  '신천포차',
  '신진슈퍼',
  '태태삼겹 신당2호점',
  '시즌모먼트',
  '카페스페이스530',
  '아이술래',
  '성북동막걸리',
  '서촌주점',
  '스태픽스',
  '서초옥상',
  '서울식품',
  '서아진 루프탑송리단길점',
  '서문객잔',
  '상수주택',
  '상수주택',
  '삼천리골 돼지집',
  '삼미정',
  'SOUND CLASKA',
  '사당동부산오뎅',
  '빈야드15',
  '비틀스타코',
  'BBQ 빌리지 호텔더보타닉세운명동점',
  '불꽃여자',
  '북한산인수재',
  '부산집',
  '봉구비어 오목교역점',
  '백만불식품',
  '배고픈돼지',
  '방울과꼬막',
  '방방',
  '방목',
  '밥도사술도사',
  '반원칼국수',
  '미진숯불막창',
  '미갈매기살',
  '뮌헨호프',
  '문화식당',
  '문래옥상',
  '무채색',
  '모아식품',
  '명동골뱅이',
  '메종드쌍문',
  '메이게츠 군자',
  '멍석집',
  '먹거리장터2',
  '먹거리장터',
  '매일호프',
  '원조만선호프 노가리체인본점',
  '만리재비스트로',
  '마포주먹고기 고척돔점',
  '마포 껍데기',
  '마당족발',
  '리제로 서울',
  '르스타일바',
  '루프탑스테이',
  '루프탑 피자펍',
  '루프탑어반비치',
  '루프탑스테이',
  '루프808',
  '랜돌프비어 마곡나루',
  '뚝도지기',
  '뚝도지기',
  '뚝도지기',
  '디자이너리카페',
  '동해남부선 서촌본점',
  '동해골뱅이',
  '동백상회',
  '동백상회',
  '조일식품',
  '동남옥탑',
  '도시섬',
  '도봉산양고기',
  '더백테라스 신용산점',
  '대파곱창',
  '대원식당',
  '대성골뱅이',
  '대림호프커피',
  '대나무집',
  '당인동국수공장',
  '달사막',
  '달빛야장',
  '달맞이광장바베큐',
  '달막달막',
  '달 루프탑',
  '다트플렉스 강남점',
  '다운이네',
  '을지다락',
  '다락 오금역점',
  '다동황소막창',
  '누이트',
  '누룩나무',
  '넬보스코 루프탑라운지&바',
  '넬보스코 루프탑라운지&바',
  '낙성아주',
  '낙산공원',
  '나누리잡화점'
)
AND id NOT IN (
  SELECT place_id FROM curator_places WHERE curator_id = '43b3eb72-a835-4b5b-b305-da4708b53b5c'
);