-- 코스 픽 RPC: 이미 픽한 코스 재요청·동시 요청 시 409 대신 기존 스냅샷 id 반환

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
    RAISE EXCEPTION '공개된 코스만 픽할 수 있습니다.';
  END IF;

  IF v_src.curator_id = v_user THEN
    RAISE EXCEPTION '내가 만든 코스는 픽할 수 없습니다.';
  END IF;

  SELECT count(*)::integer INTO v_step_count
  FROM public.curator_course_places
  WHERE course_id = p_source_course_id;

  IF v_step_count < 1 THEN
    RAISE EXCEPTION '장소가 없는 코스는 픽할 수 없습니다.';
  END IF;

  BEGIN
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
  EXCEPTION
    WHEN unique_violation THEN
      SELECT cc.id INTO v_existing
      FROM public.curator_courses cc
      WHERE cc.curator_id = v_user
        AND cc.imported_from_course_id = p_source_course_id
      LIMIT 1;
      IF v_existing IS NOT NULL THEN
        RETURN v_existing;
      END IF;
      RAISE;
  END;

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

NOTIFY pgrst, 'reload schema';
