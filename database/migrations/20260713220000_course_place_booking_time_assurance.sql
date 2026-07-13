-- 코스 스텝 시간 보장(Time Assurance): 예약 상태·외부 링크·혼잡 메모
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

COMMENT ON COLUMN public.curator_course_places.booking_status IS
  '시간 보장 배지: unknown|bookable|recommended|walkin';
COMMENT ON COLUMN public.curator_course_places.booking_url IS
  '외부 예약 URL (네이버·캐치테이블 등)';
COMMENT ON COLUMN public.curator_course_places.booking_phone IS
  '전화 예약 번호';
COMMENT ON COLUMN public.curator_course_places.crowd_note IS
  '혼잡·웨이팅 짧은 힌트 (예: 금요일 혼잡)';
