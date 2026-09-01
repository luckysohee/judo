-- 맛집첩(잔리스트) 공개 시 타인 장소 목록 통째 복사 방지
-- 경고: 겹침 >= 4 AND 겹침/작은쪽 >= 70%
-- 차단: 겹침 >= 5 AND 겹침/작은쪽 >= 75%
-- 비교 대상: 공개 장소(is_archived IS NOT TRUE) 5곳 이상인 다른 큐레이터

CREATE OR REPLACE FUNCTION public.curator_places_assess_publish_overlap(
  p_curator_id uuid,
  p_place_id uuid,
  p_curator_place_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_my_count integer;
  v_best_overlap integer := 0;
  v_best_ratio numeric := 0;
  v_best_peer uuid;
  v_level text := 'ok';
  v_message text := NULL;
  rec record;
  v_warn_overlap constant integer := 4;
  v_warn_ratio constant numeric := 0.70;
  v_block_overlap constant integer := 5;
  v_block_ratio constant numeric := 0.75;
  v_peer_min constant integer := 5;
BEGIN
  IF p_curator_id IS NULL OR p_place_id IS NULL THEN
    RETURN jsonb_build_object('level', 'ok');
  END IF;

  SELECT count(DISTINCT pid)::integer
  INTO v_my_count
  FROM (
    SELECT cp.place_id AS pid
    FROM public.curator_places cp
    WHERE cp.curator_id = p_curator_id
      AND cp.is_archived IS NOT TRUE
      AND cp.place_id IS NOT NULL
      AND (p_curator_place_id IS NULL OR cp.id <> p_curator_place_id)
    UNION
    SELECT p_place_id
  ) s;

  IF v_my_count IS NULL OR v_my_count < 1 THEN
    RETURN jsonb_build_object('level', 'ok', 'my_public_count', 0);
  END IF;

  FOR rec IN
    WITH my_places AS (
      SELECT DISTINCT cp.place_id AS pid
      FROM public.curator_places cp
      WHERE cp.curator_id = p_curator_id
        AND cp.is_archived IS NOT TRUE
        AND cp.place_id IS NOT NULL
        AND (p_curator_place_id IS NULL OR cp.id <> p_curator_place_id)
      UNION
      SELECT p_place_id
    ),
    peer_stats AS (
      SELECT
        o.curator_id AS peer_id,
        count(DISTINCT o.place_id)::integer AS peer_public_count,
        count(DISTINCT o.place_id) FILTER (
          WHERE o.place_id IN (SELECT pid FROM my_places)
        )::integer AS overlap_count
      FROM public.curator_places o
      WHERE o.curator_id IS DISTINCT FROM p_curator_id
        AND o.is_archived IS NOT TRUE
        AND o.place_id IS NOT NULL
      GROUP BY o.curator_id
      HAVING count(DISTINCT o.place_id) >= v_peer_min
    )
    SELECT
      peer_id,
      peer_public_count,
      overlap_count,
      CASE
        WHEN least(v_my_count, peer_public_count) > 0 THEN
          round(
            overlap_count::numeric / least(v_my_count, peer_public_count)::numeric,
            4
          )
        ELSE 0::numeric
      END AS overlap_ratio
    FROM peer_stats
    WHERE overlap_count > 0
    ORDER BY overlap_count DESC, overlap_ratio DESC
  LOOP
    IF rec.overlap_count > v_best_overlap
       OR (
         rec.overlap_count = v_best_overlap
         AND rec.overlap_ratio > v_best_ratio
       )
    THEN
      v_best_overlap := rec.overlap_count;
      v_best_ratio := rec.overlap_ratio;
      v_best_peer := rec.peer_id;
    END IF;
  END LOOP;

  IF v_best_overlap >= v_block_overlap AND v_best_ratio >= v_block_ratio THEN
    v_level := 'block';
    v_message :=
      '다른 큐레이터와 공개 장소가 너무 많이 겹쳐 공개할 수 없어요. 직접 다녀본 곳만 올려 주세요.';
  ELSIF v_best_overlap >= v_warn_overlap AND v_best_ratio >= v_warn_ratio THEN
    v_level := 'warn';
    v_message :=
      '다른 큐레이터와 공개 장소가 많이 겹쳐요. 직접 다녀본 곳 위주로 올려 주세요.';
  END IF;

  RETURN jsonb_build_object(
    'level', v_level,
    'overlap_count', v_best_overlap,
    'overlap_ratio', v_best_ratio,
    'my_public_count', v_my_count,
    'peer_curator_id', v_best_peer,
    'message', v_message
  );
END;
$func$;

COMMENT ON FUNCTION public.curator_places_assess_publish_overlap(uuid, uuid, uuid) IS
  '잔리스트 공개 전 겹침 평가. warn 4+/70%, block 5+/75%, peer 공개 5곳 이상만 비교.';

CREATE OR REPLACE FUNCTION public.check_curator_place_publish_overlap(p_place_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user uuid := auth.uid();
  v_row public.curator_places%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.'
      USING ERRCODE = '42501';
  END IF;

  IF p_place_id IS NULL THEN
    RETURN jsonb_build_object('level', 'ok');
  END IF;

  SELECT *
  INTO v_row
  FROM public.curator_places cp
  WHERE cp.curator_id = v_user
    AND cp.place_id = p_place_id
  ORDER BY cp.created_at DESC
  LIMIT 1;

  RETURN public.curator_places_assess_publish_overlap(
    v_user,
    p_place_id,
    v_row.id
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.check_curator_place_publish_overlap(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_curator_place_publish_overlap(uuid) TO authenticated;

COMMENT ON FUNCTION public.check_curator_place_publish_overlap(uuid) IS
  '본인 잔리스트 장소 공개 전 겹침 평가(JSON). 클라이언트 경고용.';

CREATE OR REPLACE FUNCTION public.curator_places_block_overlap_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  v_assessment jsonb;
  v_level text;
BEGIN
  IF NEW.is_archived IS TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_archived IS NOT TRUE AND OLD.place_id IS NOT DISTINCT FROM NEW.place_id THEN
      RETURN NEW;
    END IF;
  END IF;

  v_assessment := public.curator_places_assess_publish_overlap(
    NEW.curator_id,
    NEW.place_id,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END
  );

  v_level := COALESCE(v_assessment->>'level', 'ok');
  IF v_level = 'block' THEN
    RAISE EXCEPTION '%', COALESCE(
      v_assessment->>'message',
      '다른 큐레이터와 공개 장소가 너무 많이 겹쳐 공개할 수 없어요.'
    )
      USING ERRCODE = 'check_violation',
            HINT = 'overlap_count=' || COALESCE(v_assessment->>'overlap_count', '0');
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS curator_places_block_overlap_on_publish_ins_trg
  ON public.curator_places;
CREATE TRIGGER curator_places_block_overlap_on_publish_ins_trg
  BEFORE INSERT ON public.curator_places
  FOR EACH ROW
  WHEN (NEW.is_archived IS NOT TRUE)
  EXECUTE FUNCTION public.curator_places_block_overlap_on_publish();

DROP TRIGGER IF EXISTS curator_places_block_overlap_on_publish_upd_trg
  ON public.curator_places;
CREATE TRIGGER curator_places_block_overlap_on_publish_upd_trg
  BEFORE UPDATE OF is_archived, place_id ON public.curator_places
  FOR EACH ROW
  WHEN (
    NEW.is_archived IS NOT TRUE
    AND (
      OLD.is_archived IS TRUE
      OR OLD.place_id IS DISTINCT FROM NEW.place_id
    )
  )
  EXECUTE FUNCTION public.curator_places_block_overlap_on_publish();

NOTIFY pgrst, 'reload schema';
