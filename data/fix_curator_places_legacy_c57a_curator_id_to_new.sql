-- JSON/임포트에 쓰이던 레거시 curator_id (soju_anjo 예전 curators.id)
--   c57a5dc3-8d63-4a77-81e1-bfb22065c5b7
-- → 현재 curators.id 로 쓰는 값 (fix_curators_soju_anjo_set_id.sql 과 동일해야 함)
--   d5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b
--
-- curators.id 를 먼저 바꾼 뒤에도 curator_places 에 구 id 가 남아 있으면 이 스크립트로 정리.
--
-- ① 남은 건수
-- SELECT count(*) FROM public.curator_places
-- WHERE curator_id::text = 'c57a5dc3-8d63-4a77-81e1-bfb22065c5b7';
--
-- ② 실행

BEGIN;

UPDATE public.curator_places cp
SET curator_id = 'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::uuid
WHERE cp.curator_id::text = 'c57a5dc3-8d63-4a77-81e1-bfb22065c5b7';

UPDATE public.user_follows uf
SET curator_id = 'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::text
WHERE uf.curator_id IS NOT DISTINCT FROM 'c57a5dc3-8d63-4a77-81e1-bfb22065c5b7';

COMMIT;
