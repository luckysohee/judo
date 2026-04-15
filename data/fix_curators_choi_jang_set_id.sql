-- choi_jang 큐레이터 행의 public.curators.id 를 고정 UUID 로 교체합니다.
-- 예전 id 로 저장된 curator_places.curator_id · user_follows.curator_id 도 같이 맞춥니다.
--
-- DB 스키마(예시 한 줄): slug = choi_jang, name = 최장,
--   id = b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f, user_id = c0aca16e-7435-4d4b-96e2-e4eaa8ea8384
--
-- Supabase SQL Editor: ① 확인 → ② 실행.
--
-- ① 현재 id
-- SELECT id, user_id, slug, name
-- FROM public.curators
-- WHERE slug = 'choi_jang';
--
-- FK 주의: curator_places.curator_id 가 curators(id) 를 참조하는데 DEFERRABLE 이 아니면,
-- "자식을 new_id 로 먼저 바꾸기"와 "부모 PK 를 new_id 로 바꾸기"가 동시에 만족되지 않아 실패할 수 있습니다.
-- 그때는 스테이징에서 FK 정의를 확인하거나, 제약을 잠시 내린 뒤 수동으로 맞추세요.
--
-- 주의: 새 id 가 이미 다른 curators 행의 PK 이면 UNIQUE/PK 충돌로 실패합니다.
-- slug 컬럼이 없는 DB 면 WHERE 를 username 기준으로 바꿉니다.

BEGIN;

WITH old_row AS (
  SELECT c.id AS old_id
  FROM public.curators c
  WHERE c.slug IS NOT DISTINCT FROM 'choi_jang'
  LIMIT 1
),
params AS (
  SELECT
    old_id,
    'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f'::uuid AS new_id
  FROM old_row
  WHERE old_id IS NOT NULL
    AND old_id <> 'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f'::uuid
)
UPDATE public.curator_places cp
SET curator_id = (SELECT new_id FROM params)
WHERE cp.curator_id = (SELECT old_id FROM params)
  AND EXISTS (SELECT 1 FROM params);

WITH old_row AS (
  SELECT c.id AS old_id
  FROM public.curators c
  WHERE c.slug IS NOT DISTINCT FROM 'choi_jang'
  LIMIT 1
),
params AS (
  SELECT
    old_id,
    'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f'::uuid AS new_id
  FROM old_row
  WHERE old_id IS NOT NULL
    AND old_id <> 'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f'::uuid
)
-- user_follows.curator_id 는 일부 DB 에서 text 저장 (uuid 와 직접 비교 시 42883)
UPDATE public.user_follows uf
SET curator_id = (SELECT new_id::text FROM params)
WHERE uf.curator_id IS NOT DISTINCT FROM (SELECT old_id::text FROM params)
  AND EXISTS (SELECT 1 FROM params);

UPDATE public.curators c
SET id = 'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f'::uuid
FROM (
  SELECT c2.id AS old_id
  FROM public.curators c2
  WHERE c2.slug IS NOT DISTINCT FROM 'choi_jang'
  LIMIT 1
) t
WHERE c.id = t.old_id
  AND t.old_id IS DISTINCT FROM 'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f'::uuid;

COMMIT;
