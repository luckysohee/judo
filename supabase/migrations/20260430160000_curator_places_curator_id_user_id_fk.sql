-- curator_places.curator_id = 큐레이터 계정(auth) = public.curators.user_id 로 통일
-- 기존에 curators.id(PK)가 들어간 행은 user_id 로 치환한 뒤 FK 를 curators(user_id) 로 재생성

BEGIN;

-- 레거시: curator_id 가 curators 행 PK 였던 경우 → 해당 행의 user_id 로 교체
UPDATE public.curator_places cp
SET curator_id = c.user_id
FROM public.curators c
WHERE cp.curator_id = c.id
  AND c.user_id IS NOT NULL
  AND cp.curator_id IS DISTINCT FROM c.user_id;

-- curators 에 없는 값은 제거 (FK 추가 전 정리; 운영에서는 백업 후 검토 권장)
DELETE FROM public.curator_places cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.curators c WHERE c.user_id = cp.curator_id
);

ALTER TABLE public.curator_places
  DROP CONSTRAINT IF EXISTS curator_places_curator_id_fkey;

ALTER TABLE public.curator_places
  ADD CONSTRAINT curator_places_curator_id_fkey
  FOREIGN KEY (curator_id)
  REFERENCES public.curators (user_id)
  ON DELETE CASCADE;

COMMENT ON COLUMN public.curator_places.curator_id IS
  '큐레이터 auth 사용자 UUID (= public.curators.user_id). curators.id(PK) 아님.';

COMMIT;
