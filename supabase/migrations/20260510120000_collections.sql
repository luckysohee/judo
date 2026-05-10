-- 컬렉션(시리즈/리스트). 큐레이터에 한정하지 않고 모든 인증 사용자가 만들 수 있다.
-- 한 사용자가 여러 개의 공개/비공개 컬렉션을 갖고, 각 컬렉션은 다수의 장소를
-- 순서·메모와 함께 가진다.
--
-- 구조:  auth.users(id) ─< collections ─< collection_places >─ places
--
-- 기존 curator_places 는 그대로 유지(현재 잔 리스트/지도 노출이 그것을 사용).
-- migrate_curator_places_into_collection RPC 로 점진 이동을 지원한다.

------------------------------------------------------------------------------
-- 1) collections
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  subtitle TEXT,
  description TEXT,
  cover_image TEXT,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_collections_user_created
  ON public.collections (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collections_public_recent
  ON public.collections (visibility, created_at DESC)
  WHERE visibility = 'public';

COMMENT ON TABLE public.collections IS
  '사용자(큐레이터/일반)가 만드는 공개·비공개 컬렉션. user_id = auth.uid(). curator_places 와 독립 운용, 점진 이동 가능.';

COMMENT ON COLUMN public.collections.user_id IS
  '소유자 auth uid. 큐레이터 한정 아님.';

COMMENT ON COLUMN public.collections.subtitle IS
  '한 줄 부제(선택). 카드 노출용 짧은 문구.';

COMMENT ON COLUMN public.collections.description IS
  '본문 설명(선택, 긴 텍스트).';

COMMENT ON COLUMN public.collections.cover_image IS
  '커버 이미지 URL(선택). 외부 호스팅 또는 storage 경로.';

COMMENT ON COLUMN public.collections.visibility IS
  'public: 비로그인 포함 누구나 조회 / private: 본인만 조회.';

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.collections_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS collections_touch_updated_at_trg
  ON public.collections;
CREATE TRIGGER collections_touch_updated_at_trg
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.collections_touch_updated_at();

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collections_select_public_or_own"
  ON public.collections;
CREATE POLICY "collections_select_public_or_own"
  ON public.collections
  FOR SELECT
  USING (visibility = 'public' OR user_id = auth.uid());

COMMENT ON POLICY "collections_select_public_or_own"
  ON public.collections IS
  '공개 컬렉션은 anon/authenticated 모두 조회. 비공개는 본인만.';

DROP POLICY IF EXISTS "collections_insert_own"
  ON public.collections;
CREATE POLICY "collections_insert_own"
  ON public.collections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "collections_update_own"
  ON public.collections;
CREATE POLICY "collections_update_own"
  ON public.collections
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "collections_delete_own"
  ON public.collections;
CREATE POLICY "collections_delete_own"
  ON public.collections
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.collections TO authenticated;

------------------------------------------------------------------------------
-- 2) collection_places  (collection ↔ place 다대다 + 순서 + 메모)
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.collection_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL
    REFERENCES public.collections (id) ON DELETE CASCADE,
  place_id UUID NOT NULL
    REFERENCES public.places (id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT collection_places_unique UNIQUE (collection_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_places_collection_order
  ON public.collection_places (collection_id, order_index, created_at);

CREATE INDEX IF NOT EXISTS idx_collection_places_place
  ON public.collection_places (place_id);

COMMENT ON TABLE public.collection_places IS
  '컬렉션에 포함된 장소(순서 + 메모). 동일 장소는 컬렉션당 1행(UNIQUE).';

COMMENT ON COLUMN public.collection_places.order_index IS
  '컬렉션 내 노출 순서. 낮을수록 먼저. 동률은 created_at 으로 결정.';

COMMENT ON COLUMN public.collection_places.memo IS
  '소유자가 컬렉션 안에서 이 장소에 남기는 한 줄 메모(선택).';

ALTER TABLE public.collection_places ENABLE ROW LEVEL SECURITY;

-- 자식 RLS 는 부모(collections) 의 visibility / user_id 를 따른다.

DROP POLICY IF EXISTS "collection_places_select_via_parent"
  ON public.collection_places;
CREATE POLICY "collection_places_select_via_parent"
  ON public.collection_places
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_places.collection_id
        AND (c.visibility = 'public' OR c.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "collection_places_insert_own"
  ON public.collection_places;
CREATE POLICY "collection_places_insert_own"
  ON public.collection_places
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_places.collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "collection_places_update_own"
  ON public.collection_places;
CREATE POLICY "collection_places_update_own"
  ON public.collection_places
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_places.collection_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_places.collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "collection_places_delete_own"
  ON public.collection_places;
CREATE POLICY "collection_places_delete_own"
  ON public.collection_places
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_places.collection_id
        AND c.user_id = auth.uid()
    )
  );

GRANT SELECT ON TABLE public.collection_places TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.collection_places TO authenticated;

------------------------------------------------------------------------------
-- 3) RPC: 컬렉션 + 장소를 한 번에 생성 (트랜잭션)
--    p_place_ids 의 배열 순서대로 order_index = 0..n-1 부여.
--    호출자 auth.uid() 가 user_id 로 강제 세팅된다.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_collection_with_places(
  p_title TEXT,
  p_subtitle TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_cover_image TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_place_ids UUID[] DEFAULT '{}'::uuid[]
)
RETURNS public.collections
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.collections;
  v_place UUID;
  v_idx INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'invalid visibility: %', p_visibility;
  END IF;

  INSERT INTO public.collections (
    user_id, title, subtitle, description, cover_image, visibility
  )
  VALUES (
    v_uid,
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_subtitle, '')), ''),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    NULLIF(btrim(COALESCE(p_cover_image, '')), ''),
    p_visibility
  )
  RETURNING * INTO v_row;

  IF p_place_ids IS NOT NULL THEN
    FOREACH v_place IN ARRAY p_place_ids LOOP
      INSERT INTO public.collection_places (collection_id, place_id, order_index)
      VALUES (v_row.id, v_place, v_idx)
      ON CONFLICT (collection_id, place_id) DO NOTHING;
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  RETURN v_row;
END;
$func$;

REVOKE ALL ON FUNCTION public.create_collection_with_places(
  text, text, text, text, text, uuid[]
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_collection_with_places(
  text, text, text, text, text, uuid[]
) TO authenticated;

COMMENT ON FUNCTION public.create_collection_with_places(
  text, text, text, text, text, uuid[]
) IS
  '컬렉션 1건 + 장소 일괄 생성. 호출자 auth.uid() 가 user_id 로 강제 세팅, 배열 순서대로 order_index 부여.';

------------------------------------------------------------------------------
-- 4) RPC: 본인 curator_places 를 컬렉션 하나로 백필
--    p_collection_id 가 NULL 이면 p_collection_title (기본 '내 추천 잔') 으로 신규 생성.
--    동일 (collection_id, place_id) 는 ON CONFLICT DO NOTHING 으로 무시.
--    curator_places 원본은 변경하지 않는다 — 점진 이동 전제.
--    (큐레이터가 아닌 사용자가 호출하면 source 가 비어 있으므로 그냥 빈 컬렉션이 생긴다.)
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.migrate_curator_places_into_collection(
  p_collection_id UUID DEFAULT NULL,
  p_collection_title TEXT DEFAULT NULL
)
RETURNS public.collections
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.collections;
  v_inserted INTEGER;
  v_max_idx INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null';
  END IF;

  IF p_collection_id IS NULL THEN
    INSERT INTO public.collections (user_id, title)
    VALUES (
      v_uid,
      COALESCE(NULLIF(btrim(COALESCE(p_collection_title, '')), ''), '내 추천 잔')
    )
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row
      FROM public.collections
      WHERE id = p_collection_id AND user_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'collection % not found or not owned by caller', p_collection_id;
    END IF;
  END IF;

  -- 기존 컬렉션이라면 마지막 order_index 뒤에 이어 붙인다.
  SELECT COALESCE(MAX(order_index) + 1, 0)
    INTO v_max_idx
    FROM public.collection_places
    WHERE collection_id = v_row.id;

  WITH src AS (
    SELECT
      cp.place_id,
      ROW_NUMBER() OVER (ORDER BY cp.place_id) - 1 AS rn
    FROM public.curator_places cp
    WHERE cp.curator_id = v_uid
      AND cp.place_id IS NOT NULL
  )
  INSERT INTO public.collection_places (collection_id, place_id, order_index)
  SELECT v_row.id, src.place_id, v_max_idx + src.rn
  FROM src
  ON CONFLICT (collection_id, place_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'migrate_curator_places_into_collection: % rows inserted into %', v_inserted, v_row.id;

  RETURN v_row;
END;
$func$;

REVOKE ALL ON FUNCTION public.migrate_curator_places_into_collection(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrate_curator_places_into_collection(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.migrate_curator_places_into_collection(uuid, text) IS
  '본인 curator_places 의 place_id 를 지정 컬렉션으로 백필(없으면 신규 생성). 원본 curator_places 는 보존.';

NOTIFY pgrst, 'reload schema';
