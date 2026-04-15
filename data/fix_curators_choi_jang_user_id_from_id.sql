-- choi_jang 큐레이터: 행의 id(uuid) 값을 user_id 로 옮깁니다.
-- (user_id 가 NULL 이고 id 만 있는 레거시 정리)
--
-- 현재 정상 행 예: slug = choi_jang, user_id 가 이미 있으면 이 스크립트는 0행 갱신입니다.
--
-- Supabase SQL Editor: ① 확인 → ② 실행.
--
-- ① 대상 행
-- SELECT id, user_id, slug, name
-- FROM public.curators
-- WHERE slug = 'choi_jang';
--
-- public.curators.id 가 PRIMARY KEY NOT NULL 이면 id 를 NULL 로 비울 수 없습니다.
-- "auth 쪽 uuid 를 user_id 에 넣기" 라면 아래 UPDATE 만으로 충분합니다.

BEGIN;

UPDATE public.curators c
SET user_id = c.id
WHERE c.user_id IS NULL
  AND c.slug IS NOT DISTINCT FROM 'choi_jang';

COMMIT;
