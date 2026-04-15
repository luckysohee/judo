-- soju_anjo 큐레이터 행의 public.curators.id 를 고정 UUID 로 교체합니다.
-- 예전 id 로 저장된 curator_places.curator_id · user_follows.curator_id 도 같이 맞춥니다.
--
-- Supabase SQL Editor: ① 확인 → ② 실행.
--
-- ① 현재 id
-- SELECT id, user_id, username, display_name
-- FROM public.curators
-- WHERE username ILIKE '%soju_anjo%';
-- (slug 컬럼만 있으면 WHERE slug ILIKE '%soju_anjo%'; 로 바꿉니다.)
--
-- FK 주의: curator_places.curator_id 가 curators(id) 를 참조하는데 DEFERRABLE 이 아니면,
-- "자식을 new_id 로 먼저 바꾸기"와 "부모 PK 를 new_id 로 바꾸기"가 동시에 만족되지 않아 실패할 수 있습니다.
-- 그때는 스테이징에서 FK 정의를 확인하거나, 제약을 잠시 내린 뒤 수동으로 맞추세요.
-- 이 스크립트는 자식 테이블에 FK 가 없거나 완화된 DB 를 가정합니다.
--
-- 주의: 새 id 가 이미 다른 curators 행의 PK 이면 UNIQUE/PK 충돌로 실패합니다.

BEGIN;

WITH old_row AS (
  SELECT c.id AS old_id
  FROM public.curators c
  WHERE c.username ILIKE '%soju_anjo%'
  LIMIT 1
),
params AS (
  SELECT
    old_id,
    'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::uuid AS new_id
  FROM old_row
  WHERE old_id IS NOT NULL
    AND old_id <> 'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::uuid
)
UPDATE public.curator_places cp
SET curator_id = (SELECT new_id FROM params)
WHERE cp.curator_id = (SELECT old_id FROM params)
  AND EXISTS (SELECT 1 FROM params);

WITH old_row AS (
  SELECT c.id AS old_id
  FROM public.curators c
  WHERE c.username ILIKE '%soju_anjo%'
  LIMIT 1
),
params AS (
  SELECT
    old_id,
    'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::uuid AS new_id
  FROM old_row
  WHERE old_id IS NOT NULL
    AND old_id <> 'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::uuid
)
-- user_follows.curator_id 는 일부 DB 에서 text 저장 (uuid 와 직접 비교 시 42883)
UPDATE public.user_follows uf
SET curator_id = (SELECT new_id::text FROM params)
WHERE uf.curator_id IS NOT DISTINCT FROM (SELECT old_id::text FROM params)
  AND EXISTS (SELECT 1 FROM params);

UPDATE public.curators c
SET id = 'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::uuid
FROM (
  SELECT c2.id AS old_id
  FROM public.curators c2
  WHERE c2.username ILIKE '%soju_anjo%'
  LIMIT 1
) t
WHERE c.id = t.old_id
  AND t.old_id IS DISTINCT FROM 'd5e6f7a8-b9c0-4d1e-af2b-3c4d5e6f7a8b'::uuid;

COMMIT;
