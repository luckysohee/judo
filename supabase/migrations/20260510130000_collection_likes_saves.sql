-- 컬렉션 좋아요(`collection_likes`) / 저장(`collection_saves`).
--
-- - 두 테이블은 같은 셰이프이지만, 의미를 분리한다.
--     likes : 가벼운 반응(공개적으로 집계 가능, "이 컬렉션 좋아요 N개")
--     saves : 내 라이브러리에 보관(본인 동선 컬렉션 모음)
-- - 공개 컬렉션의 (좋아요/저장) 행은 누구나 SELECT 할 수 있어 카운트/리스트 노출이 가능.
-- - 비공개 컬렉션에 대해서는 본인 행만 SELECT 가능(타인은 컬렉션 자체가 안 보이므로 자연스럽게 0).
-- - INSERT/DELETE 는 auth.uid() = user_id 인 본인만.
-- - UPDATE 는 의미가 없어 정책을 두지 않는다(이게 사실상 차단).
-- - `collections`, `collection_places`, `curator_places` 등 기존 테이블은 전혀 변경하지 않는다.

------------------------------------------------------------------------------
-- 1) collection_likes
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.collection_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL
    REFERENCES public.collections (id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT collection_likes_unique UNIQUE (collection_id, user_id)
);

-- 카드/상세에서 "이 컬렉션 좋아요 수" 빠르게 집계.
CREATE INDEX IF NOT EXISTS idx_collection_likes_collection_recent
  ON public.collection_likes (collection_id, created_at DESC);

-- "내가 좋아요 한 컬렉션" 최신순.
CREATE INDEX IF NOT EXISTS idx_collection_likes_user_recent
  ON public.collection_likes (user_id, created_at DESC);

COMMENT ON TABLE public.collection_likes IS
  '컬렉션 좋아요. (collection_id, user_id) 유니크. 공개 컬렉션은 누구나 카운트 가능.';

ALTER TABLE public.collection_likes ENABLE ROW LEVEL SECURITY;

-- 공개 컬렉션 좋아요는 anon/authenticated 모두 조회 가능(카운트, 누구 눌렀는지 노출용).
-- 비공개 컬렉션 좋아요는 본인 행만 조회.
DROP POLICY IF EXISTS "collection_likes_select_public_or_own"
  ON public.collection_likes;
CREATE POLICY "collection_likes_select_public_or_own"
  ON public.collection_likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_likes.collection_id
        AND c.visibility = 'public'
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "collection_likes_insert_own"
  ON public.collection_likes;
CREATE POLICY "collection_likes_insert_own"
  ON public.collection_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "collection_likes_delete_own"
  ON public.collection_likes;
CREATE POLICY "collection_likes_delete_own"
  ON public.collection_likes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- UPDATE 정책 없음 → 토글은 INSERT / DELETE 로만.

GRANT SELECT ON TABLE public.collection_likes TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.collection_likes TO authenticated;

------------------------------------------------------------------------------
-- 2) collection_saves
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.collection_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL
    REFERENCES public.collections (id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT collection_saves_unique UNIQUE (collection_id, user_id)
);

-- 공개 컬렉션 "저장 N명" 집계.
CREATE INDEX IF NOT EXISTS idx_collection_saves_collection_recent
  ON public.collection_saves (collection_id, created_at DESC);

-- "내가 저장한 컬렉션 라이브러리" 최신순.
CREATE INDEX IF NOT EXISTS idx_collection_saves_user_recent
  ON public.collection_saves (user_id, created_at DESC);

COMMENT ON TABLE public.collection_saves IS
  '컬렉션 저장(내 라이브러리 보관). (collection_id, user_id) 유니크. 공개 컬렉션 저장은 누구나 카운트 가능.';

ALTER TABLE public.collection_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collection_saves_select_public_or_own"
  ON public.collection_saves;
CREATE POLICY "collection_saves_select_public_or_own"
  ON public.collection_saves
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.collections c
      WHERE c.id = collection_saves.collection_id
        AND c.visibility = 'public'
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "collection_saves_insert_own"
  ON public.collection_saves;
CREATE POLICY "collection_saves_insert_own"
  ON public.collection_saves
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "collection_saves_delete_own"
  ON public.collection_saves;
CREATE POLICY "collection_saves_delete_own"
  ON public.collection_saves
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- UPDATE 정책 없음 → 토글은 INSERT / DELETE 로만.

GRANT SELECT ON TABLE public.collection_saves TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.collection_saves TO authenticated;

NOTIFY pgrst, 'reload schema';
