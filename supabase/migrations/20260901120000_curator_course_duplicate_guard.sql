-- 타인 잔코스(공개 코스) 무단 복제 방지:
-- 1) 동일 장소·동일 순서로 공개 시 차단 → 코스 스크랩(import) 유도
-- 2) 다른 큐레이터 추천 한줄(one_line_reason) 고유도 검사

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 코스 장소 순서 시그니처 (place_id 를 order_index 순으로 연결)
CREATE OR REPLACE FUNCTION public.curator_course_place_signature(p_course_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $func$
  SELECT string_agg(place_id::text, ',' ORDER BY order_index)
  FROM public.curator_course_places
  WHERE course_id = p_course_id;
$func$;

COMMENT ON FUNCTION public.curator_course_place_signature(uuid) IS
  '코스 내 place_id 를 order_index 순으로 연결한 시그니처. 동일 시퀀스 중복 공개 탐지용.';

-- 다른 큐레이터의 공개 원본 코스와 장소 순서가 같으면 해당 course id 반환
CREATE OR REPLACE FUNCTION public.curator_course_find_duplicate_public(p_course_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  WITH mine AS (
    SELECT
      cc.curator_id,
      public.curator_course_place_signature(p_course_id) AS sig
    FROM public.curator_courses cc
    WHERE cc.id = p_course_id
  )
  SELECT cc.id
  FROM public.curator_courses cc
  CROSS JOIN mine m
  WHERE cc.id <> p_course_id
    AND cc.status = 'published'
    AND cc.is_public = true
    AND cc.imported_from_course_id IS NULL
    AND cc.curator_id <> m.curator_id
    AND public.curator_course_place_signature(cc.id) = m.sig
    AND m.sig IS NOT NULL
    AND char_length(m.sig) > 0
  LIMIT 1;
$func$;

COMMENT ON FUNCTION public.curator_course_find_duplicate_public(uuid) IS
  '동일 장소·순서의 타인 공개 원본 코스 id. 없으면 NULL.';

-- 직접 UPDATE 로 공개할 때도 동일 검사 (클라이언트 우회 방지)
CREATE OR REPLACE FUNCTION public.curator_courses_block_duplicate_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  v_dup uuid;
  v_place_count integer;
BEGIN
  IF NEW.status = 'published'
     AND NEW.is_public = true
     AND (
       OLD.status IS DISTINCT FROM 'published'
       OR OLD.is_public IS DISTINCT FROM true
     )
  THEN
    IF NEW.imported_from_course_id IS NOT NULL THEN
      RAISE EXCEPTION '가져온 코스는 공개할 수 없습니다.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*)::integer INTO v_place_count
    FROM public.curator_course_places
    WHERE course_id = NEW.id;

    IF v_place_count < 2 THEN
      RAISE EXCEPTION '코스는 최소 2개 이상의 장소가 필요합니다.'
        USING ERRCODE = 'check_violation';
    END IF;

    v_dup := public.curator_course_find_duplicate_public(NEW.id);
    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION
        '이미 같은 장소 순서의 공개 코스가 있어요. 코스 스크랩 기능을 이용해 주세요.'
        USING ERRCODE = 'check_violation',
              HINT = 'duplicate_course_id=' || v_dup::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_courses_block_duplicate_publish_trg
  ON public.curator_courses;
CREATE TRIGGER curator_courses_block_duplicate_publish_trg
  BEFORE UPDATE ON public.curator_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_courses_block_duplicate_publish();

-- 공개 RPC (COUNT + 중복 검사 + UPDATE 를 한 트랜잭션)
CREATE OR REPLACE FUNCTION public.publish_curator_course(p_course_id uuid)
RETURNS public.curator_courses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_row public.curator_courses%ROWTYPE;
  v_dup uuid;
  v_place_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.curator_courses
  WHERE id = p_course_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '코스를 찾을 수 없습니다.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_row.curator_id <> v_user THEN
    RAISE EXCEPTION '본인 코스만 공개할 수 있습니다.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.imported_from_course_id IS NOT NULL THEN
    RAISE EXCEPTION '스크랩한 코스는 수정하거나 공개할 수 없습니다.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*)::integer INTO v_place_count
  FROM public.curator_course_places
  WHERE course_id = p_course_id;

  IF v_place_count < 2 THEN
    RAISE EXCEPTION '코스는 최소 2개 이상의 장소가 필요합니다.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_dup := public.curator_course_find_duplicate_public(p_course_id);
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION
      '이미 같은 장소 순서의 공개 코스가 있어요. 코스 스크랩 기능을 이용해 주세요.'
      USING ERRCODE = 'check_violation',
            HINT = 'duplicate_course_id=' || v_dup::text;
  END IF;

  UPDATE public.curator_courses
  SET status = 'published',
      is_public = true
  WHERE id = p_course_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$func$;

REVOKE ALL ON FUNCTION public.publish_curator_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_curator_course(uuid) TO authenticated;

COMMENT ON FUNCTION public.publish_curator_course(uuid) IS
  '본인 코스 공개 — 장소 2곳 이상, 타인과 동일 장소·순서 공개 차단.';

-- 큐레이터 추천 한줄 표절 방지 (같은 장소, 다른 큐레이터, 높은 trgm 유사도)
CREATE OR REPLACE FUNCTION public.curator_places_block_plagiarized_reason()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  v_reason text;
  v_found boolean;
BEGIN
  v_reason := TRIM(COALESCE(NEW.one_line_reason, ''));
  IF char_length(v_reason) < 10 THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.curator_places cp
    WHERE cp.place_id = NEW.place_id
      AND cp.curator_id IS DISTINCT FROM NEW.curator_id
      AND cp.id IS DISTINCT FROM COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND char_length(TRIM(COALESCE(cp.one_line_reason, ''))) >= 10
      AND (
        TRIM(cp.one_line_reason) = v_reason
        OR similarity(TRIM(cp.one_line_reason), v_reason) >= 0.82
      )
  ) INTO v_found;

  IF v_found THEN
    RAISE EXCEPTION
      '다른 큐레이터의 추천 문구와 너무 비슷해요. 본인만의 한 줄로 작성해 주세요.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_places_block_plagiarized_reason_ins_trg
  ON public.curator_places;
CREATE TRIGGER curator_places_block_plagiarized_reason_ins_trg
  BEFORE INSERT ON public.curator_places
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_places_block_plagiarized_reason();

DROP TRIGGER IF EXISTS curator_places_block_plagiarized_reason_upd_trg
  ON public.curator_places;
CREATE TRIGGER curator_places_block_plagiarized_reason_upd_trg
  BEFORE UPDATE OF one_line_reason ON public.curator_places
  FOR EACH ROW
  WHEN (
    TRIM(COALESCE(NEW.one_line_reason, ''))
      IS DISTINCT FROM TRIM(COALESCE(OLD.one_line_reason, ''))
  )
  EXECUTE FUNCTION public.curator_places_block_plagiarized_reason();

NOTIFY pgrst, 'reload schema';
