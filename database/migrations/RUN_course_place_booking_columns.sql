-- ★ Supabase SQL Editor에서 이 파일 전체를 실행하세요
-- 코스 스텝 예약/시간보장 컬럼 (없으면 코스 미리보기 400)

ALTER TABLE public.curator_course_places
  ADD COLUMN IF NOT EXISTS booking_status text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS booking_phone text,
  ADD COLUMN IF NOT EXISTS crowd_note text;

UPDATE public.curator_course_places
SET booking_status = 'unknown'
WHERE booking_status IS NULL;

ALTER TABLE public.curator_course_places
  ALTER COLUMN booking_status SET DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'curator_course_places_booking_status_check'
  ) THEN
    ALTER TABLE public.curator_course_places
      ADD CONSTRAINT curator_course_places_booking_status_check
      CHECK (
        booking_status IS NULL
        OR booking_status IN (
          'unknown',
          'bookable',
          'recommended',
          'walkin'
        )
      );
  END IF;
END $$;
