-- 운영자 추천(EDITOR PICK) 컬럼 + 인덱스 + 관리자 UPDATE 정책.
--
-- 초기 런칭 품질 확보용. 일반 유저(소유자)는 `updateCollection` 화이트리스트가
-- 이 컬럼들을 제외하므로 클라이언트에서 직접 토글할 수 없다. 관리자 세션은
-- 아래 admin UPDATE 정책 + RLS OR 결합으로 임의 컬렉션을 featured 처리할 수 있다.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank INTEGER,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

COMMENT ON COLUMN public.collections.is_featured IS
  '운영자 추천 여부 (EDITOR PICK 배지·홈 우선 노출).';

COMMENT ON COLUMN public.collections.featured_rank IS
  'featured 코스끼리 정렬 우선순위(낮을수록 먼저). NULL 이면 created_at desc.';

COMMENT ON COLUMN public.collections.featured_until IS
  '추천 만료 시각. NULL 이면 무기한. 만료 후 클라이언트는 일반 코스로 취급.';

-- 활성 featured 만 빠르게 sort/limit. featured_until 만료는 클라이언트에서 한 번 더 거른다.
CREATE INDEX IF NOT EXISTS idx_collections_featured_active
  ON public.collections (featured_rank NULLS LAST, created_at DESC)
  WHERE is_featured = true AND visibility = 'public';

DROP POLICY IF EXISTS "Admins can update featured fields on collections"
  ON public.collections;
CREATE POLICY "Admins can update featured fields on collections"
  ON public.collections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
