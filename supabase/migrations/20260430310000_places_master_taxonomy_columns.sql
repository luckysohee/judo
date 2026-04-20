-- studio_archive_extended_insights 등: places(p)와 curator_places 병합 시 참조
-- 프로덕션에 테이블만 있고 확장 컬럼이 없으면 "column p.alcohol_type does not exist"

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS alcohol_type text;

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS atmosphere text;

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.places.alcohol_type IS '장소 마스터 주종(스튜디오 잔 올리기·통계 병합용)';
COMMENT ON COLUMN public.places.atmosphere IS '장소 마스터 분위기(통계 병합용)';
COMMENT ON COLUMN public.places.tags IS '장소 마스터 태그(통계 병합용)';

NOTIFY pgrst, 'reload schema';
