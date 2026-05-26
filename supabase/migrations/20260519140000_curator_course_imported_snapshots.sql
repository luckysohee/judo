-- 다른 사람 공개 코스 → 내 잔 코스에 읽기 전용 스냅샷 (수정·공개 불가)

ALTER TABLE public.curator_courses
  ADD COLUMN IF NOT EXISTS imported_from_course_id UUID
    REFERENCES public.curator_courses (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.curator_courses.imported_from_course_id IS
  'NULL이 아니면 타인 코스에서 가져온 스냅샷. 수정·재공개 불가, 삭제만 가능.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_curator_courses_import_per_user_source
  ON public.curator_courses (curator_id, imported_from_course_id)
  WHERE imported_from_course_id IS NOT NULL;

ALTER TABLE public.curator_courses
  DROP CONSTRAINT IF EXISTS curator_courses_imported_snapshot_private_check;

ALTER TABLE public.curator_courses
  ADD CONSTRAINT curator_courses_imported_snapshot_private_check
  CHECK (
    imported_from_course_id IS NULL
    OR (status IN ('draft', 'private') AND is_public = false)
  );

-- 가져온 코스 메타·스텝 변경 차단 (코스 행 삭제는 허용)
CREATE OR REPLACE FUNCTION public.curator_courses_block_imported_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
  RAISE EXCEPTION '가져온 코스는 수정할 수 없습니다.';
END;
$func$;

DROP TRIGGER IF EXISTS curator_courses_block_imported_update_trg ON public.curator_courses;
CREATE TRIGGER curator_courses_block_imported_update_trg
  BEFORE UPDATE ON public.curator_courses
  FOR EACH ROW
  WHEN (OLD.imported_from_course_id IS NOT NULL)
  EXECUTE FUNCTION public.curator_courses_block_imported_update();

CREATE OR REPLACE FUNCTION public.curator_course_places_block_imported_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  v_course_id uuid;
BEGIN
  IF current_setting('app.allow_import_places', true) = '1' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  v_course_id := COALESCE(NEW.course_id, OLD.course_id);
  IF EXISTS (
    SELECT 1
    FROM public.curator_courses cc
    WHERE cc.id = v_course_id
      AND cc.imported_from_course_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION '가져온 코스의 장소는 변경할 수 없습니다.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_course_places_block_imported_ins_trg ON public.curator_course_places;
CREATE TRIGGER curator_course_places_block_imported_ins_trg
  BEFORE INSERT ON public.curator_course_places
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_course_places_block_imported_mutation();

DROP TRIGGER IF EXISTS curator_course_places_block_imported_upd_trg ON public.curator_course_places;
CREATE TRIGGER curator_course_places_block_imported_upd_trg
  BEFORE UPDATE ON public.curator_course_places
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_course_places_block_imported_mutation();

DROP TRIGGER IF EXISTS curator_course_places_block_imported_del_trg ON public.curator_course_places;
CREATE TRIGGER curator_course_places_block_imported_del_trg
  BEFORE DELETE ON public.curator_course_places
  FOR EACH ROW
  EXECUTE FUNCTION public.curator_course_places_block_imported_mutation();

DROP POLICY IF EXISTS "curator_courses_update_own" ON public.curator_courses;
CREATE POLICY "curator_courses_update_own"
  ON public.curator_courses
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = curator_id
    AND imported_from_course_id IS NULL
  )
  WITH CHECK (
    auth.uid() = curator_id
    AND imported_from_course_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.curators c WHERE c.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.import_curator_course_snapshot(p_source_course_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_existing uuid;
  v_src public.curator_courses%ROWTYPE;
  v_new_id uuid;
  v_step_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_source_course_id IS NULL THEN
    RAISE EXCEPTION '코스 ID가 올바르지 않습니다.';
  END IF;

  SELECT cc.id INTO v_existing
  FROM public.curator_courses cc
  WHERE cc.curator_id = v_user
    AND cc.imported_from_course_id = p_source_course_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_src
  FROM public.curator_courses
  WHERE id = p_source_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '코스를 찾을 수 없습니다.';
  END IF;

  IF v_src.status <> 'published' OR NOT v_src.is_public THEN
    RAISE EXCEPTION '공개된 코스만 가져올 수 있습니다.';
  END IF;

  IF v_src.curator_id = v_user THEN
    RAISE EXCEPTION '내가 만든 코스는 가져오기 대상이 아닙니다.';
  END IF;

  SELECT count(*)::integer INTO v_step_count
  FROM public.curator_course_places
  WHERE course_id = p_source_course_id;

  IF v_step_count < 1 THEN
    RAISE EXCEPTION '장소가 없는 코스는 가져올 수 없습니다.';
  END IF;

  INSERT INTO public.curator_courses (
    curator_id,
    title,
    description,
    area,
    theme_tags,
    cover_image_url,
    status,
    is_public,
    imported_from_course_id
  )
  VALUES (
    v_user,
    v_src.title,
    v_src.description,
    v_src.area,
    COALESCE(v_src.theme_tags, '{}'::text[]),
    v_src.cover_image_url,
    'private',
    false,
    p_source_course_id
  )
  RETURNING id INTO v_new_id;

  PERFORM set_config('app.allow_import_places', '1', true);

  INSERT INTO public.curator_course_places (
    course_id,
    place_id,
    order_index,
    memo,
    image_url,
    stay_minutes
  )
  SELECT
    v_new_id,
    ccp.place_id,
    ccp.order_index,
    ccp.memo,
    ccp.image_url,
    ccp.stay_minutes
  FROM public.curator_course_places ccp
  WHERE ccp.course_id = p_source_course_id
  ORDER BY ccp.order_index;

  PERFORM set_config('app.allow_import_places', '0', true);

  RETURN v_new_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.import_curator_course_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_curator_course_snapshot(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
