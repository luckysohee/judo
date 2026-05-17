-- 큐레이터 공개 코스(콘텐츠 단위). places 를 순서대로 참조 — curator_places 와 독립.
-- user_saved_courses / curator_places / 기존 테이블은 변경하지 않음.

CREATE TABLE IF NOT EXISTS public.curator_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID NOT NULL REFERENCES public.curators (user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  area TEXT,
  theme_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'draft',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_courses_status_check
    CHECK (status IN ('draft', 'published', 'private')),
  CONSTRAINT curator_courses_title_nonempty_check
    CHECK (char_length(trim(title)) > 0),
  CONSTRAINT curator_courses_is_public_implies_published_check
    CHECK (NOT is_public OR status = 'published')
);

COMMENT ON TABLE public.curator_courses IS
  '큐레이터 발행 코스(2~6장소 등은 앱·발행 시 검증). is_public 이면 반드시 status=published; draft/private 는 작성자만 RLS 로 조회.';

COMMENT ON COLUMN public.curator_courses.curator_id IS
  'auth 사용자 UUID = public.curators.user_id (curator_places.curator_id 와 동일 기준).';

COMMENT ON COLUMN public.curator_courses.status IS
  'draft | published | private — 최소 장소 개수 등은 publish RPC/앱에서 검사.';

CREATE INDEX IF NOT EXISTS idx_curator_courses_curator_id
  ON public.curator_courses (curator_id);

CREATE INDEX IF NOT EXISTS idx_curator_courses_status_public_created
  ON public.curator_courses (status, is_public, created_at DESC);

CREATE TABLE IF NOT EXISTS public.curator_course_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.curator_courses (id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places (id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL,
  memo TEXT,
  image_url TEXT,
  stay_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curator_course_places_order_nonnegative_check
    CHECK (order_index >= 0),
  CONSTRAINT curator_course_places_stay_minutes_check
    CHECK (stay_minutes IS NULL OR stay_minutes >= 0),
  CONSTRAINT curator_course_places_course_order_unique
    UNIQUE (course_id, order_index),
  CONSTRAINT curator_course_places_course_place_unique
    UNIQUE (course_id, place_id)
);

COMMENT ON TABLE public.curator_course_places IS
  '코스 내 장소 순서. 한 코스당 최대 6행은 트리거로 강제.';

CREATE INDEX IF NOT EXISTS idx_curator_course_places_course_order
  ON public.curator_course_places (course_id, order_index);

CREATE INDEX IF NOT EXISTS idx_curator_course_places_place_id
  ON public.curator_course_places (place_id);

-- 코스당 장소 최대 6개 (UI 와 맞춤)
CREATE OR REPLACE FUNCTION public.curator_course_places_enforce_max_six()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  n integer;
BEGIN
  SELECT count(*)::integer INTO n
  FROM public.curator_course_places
  WHERE course_id = NEW.course_id;

  IF n >= 6 THEN
    RAISE EXCEPTION 'curator_course_places: a course may have at most 6 places'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_course_places_enforce_max_six_trg
  ON public.curator_course_places;
CREATE TRIGGER curator_course_places_enforce_max_six_trg
  BEFORE INSERT ON public.curator_course_places
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_course_places_enforce_max_six();

-- curator_courses.updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.curator_courses_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_courses_touch_updated_at_trg ON public.curator_courses;
CREATE TRIGGER curator_courses_touch_updated_at_trg
  BEFORE UPDATE ON public.curator_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_courses_touch_updated_at();

ALTER TABLE public.curator_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curator_course_places ENABLE ROW LEVEL SECURITY;

-- ----- curator_courses -----

DROP POLICY IF EXISTS "curator_courses_select_visible" ON public.curator_courses;
CREATE POLICY "curator_courses_select_visible"
  ON public.curator_courses
  FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published' AND is_public = true)
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = curator_id
    )
  );

COMMENT ON POLICY "curator_courses_select_visible" ON public.curator_courses IS
  '공개(published+is_public) 코스는 비로그인 포함 조회. draft/private 또는 비공개 published 는 작성자(curator_id=auth.uid())만.';

DROP POLICY IF EXISTS "curator_courses_insert_own_curator" ON public.curator_courses;
CREATE POLICY "curator_courses_insert_own_curator"
  ON public.curator_courses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = curator_id
    AND EXISTS (
      SELECT 1 FROM public.curators c WHERE c.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "curator_courses_insert_own_curator" ON public.curator_courses IS
  'curator_id 는 본인 auth.uid() 이고 public.curators 에 행이 있을 때만 생성.';

DROP POLICY IF EXISTS "curator_courses_update_own" ON public.curator_courses;
CREATE POLICY "curator_courses_update_own"
  ON public.curator_courses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = curator_id)
  WITH CHECK (
    auth.uid() = curator_id
    AND EXISTS (
      SELECT 1 FROM public.curators c WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "curator_courses_delete_own" ON public.curator_courses;
CREATE POLICY "curator_courses_delete_own"
  ON public.curator_courses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = curator_id);

-- ----- curator_course_places (부모 코스 가시성·소유와 정렬) -----

DROP POLICY IF EXISTS "curator_course_places_select_visible" ON public.curator_course_places;
CREATE POLICY "curator_course_places_select_visible"
  ON public.curator_course_places
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.curator_courses cc
      WHERE cc.id = course_id
      AND (
        (cc.status = 'published' AND cc.is_public = true)
        OR (
          auth.uid() IS NOT NULL
          AND cc.curator_id = auth.uid()
        )
      )
    )
  );

COMMENT ON POLICY "curator_course_places_select_visible" ON public.curator_course_places IS
  '부모 코스를 볼 수 있으면 스텝 행도 동일 규칙으로 조회.';

DROP POLICY IF EXISTS "curator_course_places_insert_course_owner" ON public.curator_course_places;
CREATE POLICY "curator_course_places_insert_course_owner"
  ON public.curator_course_places
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.curator_courses cc
      WHERE cc.id = course_id
        AND cc.curator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "curator_course_places_update_course_owner" ON public.curator_course_places;
CREATE POLICY "curator_course_places_update_course_owner"
  ON public.curator_course_places
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.curator_courses cc
      WHERE cc.id = course_id
        AND cc.curator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.curator_courses cc
      WHERE cc.id = course_id
        AND cc.curator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "curator_course_places_delete_course_owner" ON public.curator_course_places;
CREATE POLICY "curator_course_places_delete_course_owner"
  ON public.curator_course_places
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.curator_courses cc
      WHERE cc.id = course_id
        AND cc.curator_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.curator_courses FROM PUBLIC;
GRANT SELECT ON TABLE public.curator_courses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.curator_courses TO authenticated;

REVOKE ALL ON TABLE public.curator_course_places FROM PUBLIC;
GRANT SELECT ON TABLE public.curator_course_places TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.curator_course_places TO authenticated;

NOTIFY pgrst, 'reload schema';
