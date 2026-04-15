-- soju_anjo 큐레이터: 행의 id(uuid) 값을 user_id 로 옮깁니다.
-- (스크린샷처럼 user_id 가 NULL 이고 id 만 있는 레거시 정리)
--
-- Supabase SQL Editor: ① 확인 → ② 실행.
--
-- ① 대상 행 (핸들이 username 컬럼인 DB 기준)
-- SELECT id, user_id, username, display_name
-- FROM public.curators
-- WHERE username ILIKE '%soju_anjo%';
--
-- 핸들 컬럼명이 slug 인 DB 면 WHERE 절만 아래처럼 바꿉니다.
-- WHERE slug ILIKE '%soju_anjo%';
--
-- ② id 를 NULL 로 만드는 것
-- public.curators.id 가 PRIMARY KEY NOT NULL 이면 PostgreSQL 에서 NULL 불가입니다.
-- 앱·FK 가 curators.id 를 참조하는 경우가 많아 id 를 비우면 오히려 깨집니다.
-- 의도가 "auth 쪽 uuid 를 user_id 에 넣기" 라면 아래 UPDATE 만으로 충분합니다.

BEGIN;

UPDATE public.curators c
SET user_id = c.id
WHERE c.user_id IS NULL
  AND c.username ILIKE '%soju_anjo%';

COMMIT;
