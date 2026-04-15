-- curator_places.curator_id 를 실제 큐레이터(seafood_queen)에 붙입니다.
--
-- 먼저 Supabase SQL Editor 에서 ①② 를 실행해 결과를 확인한 뒤, ③ 을 실행하세요.
--
-- ① 잘못된 uuid 로 남아 있는 행 수
-- SELECT count(*) FROM public.curator_places
-- WHERE curator_id = '8a2b5c1d-9e4f-4d2a-b7c1-3f6e9a8b2c4d'::uuid;
--
-- ② seafood_queen 행 (user_id 와 id 둘 다 적어 둠 — 아래 UPDATE 는 user_id 기준)
-- SELECT id, user_id, username, display_name FROM public.curators WHERE username ILIKE 'seafood_queen';
--
-- ③ FK 가 curators.user_id 를 가리킬 때(스튜디오가 auth.uid() 저장하는 경우가 많음)

BEGIN;

-- 이미 seafood_queen 이 같은 place_id 로 추천이 있으면, 임포트 orphan 행만 지우고 끝 (유니크 충돌 방지)
DELETE FROM public.curator_places orphan
USING public.curators c
WHERE c.username ILIKE 'seafood_queen'
  AND orphan.curator_id = '8a2b5c1d-9e4f-4d2a-b7c1-3f6e9a8b2c4d'::uuid
  AND EXISTS (
    SELECT 1
    FROM public.curator_places good
    WHERE good.place_id = orphan.place_id
      AND (
        good.curator_id = c.user_id
        OR good.curator_id = c.id
      )
  );

WITH target AS (
  SELECT c.user_id
  FROM public.curators c
  WHERE c.username ILIKE 'seafood_queen'
  LIMIT 1
)
UPDATE public.curator_places cp
SET curator_id = (SELECT user_id FROM target)
WHERE cp.curator_id = '8a2b5c1d-9e4f-4d2a-b7c1-3f6e9a8b2c4d'::uuid
  AND EXISTS (SELECT 1 FROM target);

COMMIT;

-- ---------------------------------------------------------------------------
-- ③ 실행 후 ERROR: foreign key … 이면, FK 가 curators.id 를 가리키는 DB 입니다.
-- 그때는 위 UPDATE 블록만 아래처럼 바꿔 다시 실행하세요 (DELETE 블록은 유지해도 됨).
--
-- WITH target AS (
--   SELECT c.id AS curator_pk
--   FROM public.curators c
--   WHERE c.username ILIKE 'seafood_queen'
--   LIMIT 1
-- )
-- UPDATE public.curator_places cp
-- SET curator_id = (SELECT curator_pk FROM target)
-- WHERE cp.curator_id = '8a2b5c1d-9e4f-4d2a-b7c1-3f6e9a8b2c4d'::uuid
--   AND EXISTS (SELECT 1 FROM target);
