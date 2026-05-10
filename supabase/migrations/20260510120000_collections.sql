-- 컬렉션(시리즈/리스트). 큐레이터 전용이 아닌 모든 인증 사용자가 만들 수 있다.
-- 일반 유저도 "내 데이트 코스", "가고 싶은 술집 리스트" 같은 컬렉션을 만들고,
-- 인기 컬렉션을 통해 자연스럽게 큐레이터화될 수 있는 성장 경로를 열어 둔다.
--
-- 구조:  auth.users(id) ─< collections ─< collection_places >─ places
--
-- 기존 curator_places 는 그대로 유지(잔 리스트/지도 노출이 의존).
-- 컬렉션 레이어는 이와 독립적으로 추가, 점진 이동 가능.
--
-- 이번 단계는 테이블 + RLS + 인덱스만. 편의 RPC 는 추후 추가.

------------------------------------------------------------------------------
-- 1) collections
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  description TEXT,
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
  '사용자(큐레이터/일반 모두)가 만드는 공개·비공개 컬렉션. user_id = auth.uid(). curator_places 와 독립 운용.';

COMMENT ON COLUMN public.collections.user_id IS
  '소유자 auth uid. 큐레이터 한정 아님.';

COMMENT ON COLUMN public.collections.description IS
  '본문 설명(선택, 긴 텍스트).';

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

NOTIFY pgrst, 'reload schema';
