-- Supabase 동일: supabase/migrations/20260430160000_curator_places_curator_id_user_id_fk.sql

BEGIN;

UPDATE public.curator_places cp
SET curator_id = c.user_id
FROM public.curators c
WHERE cp.curator_id = c.id
  AND c.user_id IS NOT NULL
  AND cp.curator_id IS DISTINCT FROM c.user_id;

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
