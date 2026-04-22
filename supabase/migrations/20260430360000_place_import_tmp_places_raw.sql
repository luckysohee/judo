BEGIN;

ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS places jsonb;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS raw_data jsonb;

COMMENT ON COLUMN public.place_import_tmp.places IS
  '추천 가게 목록 JSON: [{ "name": "...", "score"?: number }, ...]';
COMMENT ON COLUMN public.place_import_tmp.raw_data IS
  '크롤링·에이전트 원본 메타(선택)';

NOTIFY pgrst, 'reload schema';

COMMIT;
