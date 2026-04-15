-- curator_places.curator_id 에 auth user_id(= curators.user_id)만 넣고
-- public.curators.id(PK)를 기대하는 FK·PostgREST 조인이면 홈에서 조인·필터가 깨집니다.
-- 이 스크립트는 cp.curator_id = c.user_id 인 행을 c.id 로 바꿉니다.
--
-- ⚠️ 운영 DB가 반대로 "curator_places.curator_id = curators.user_id" 만 유효한 FK/조인이면
--    이 파일을 실행하지 마세요. (이미 user_id 로 맞춰 둔 데이터를 id 로 덮어 깨집니다.)
--
-- Supabase SQL Editor: 백업 후 실행.

BEGIN;

UPDATE public.curator_places cp
SET curator_id = c.id
FROM public.curators c
WHERE c.user_id IS NOT NULL
  AND cp.curator_id IS NOT DISTINCT FROM c.user_id
  AND c.id IS NOT NULL
  AND cp.curator_id IS DISTINCT FROM c.id;

COMMIT;
