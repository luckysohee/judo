BEGIN;

ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE public.place_import_tmp ADD COLUMN IF NOT EXISTS picked_count integer;

COMMENT ON COLUMN public.place_import_tmp.name IS
  '임포트 배치 표시용 이름 (예: 성수 노포)';
COMMENT ON COLUMN public.place_import_tmp.address IS
  '대략 구역 (예: 성수 일대)';
COMMENT ON COLUMN public.place_import_tmp.source_key IS
  '배치·중복 구분용 키 (지역-카테고리-타임스탬프)';
COMMENT ON COLUMN public.place_import_tmp.picked_count IS
  'places 배열 길이';

NOTIFY pgrst, 'reload schema';

COMMIT;
