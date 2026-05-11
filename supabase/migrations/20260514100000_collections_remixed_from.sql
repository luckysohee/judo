-- 컬렉션 리믹스 lineage: 어떤 공개 코스를 가져와서 만들었는지 한 단계 부모만 기록한다.
--
-- - 본인 가시성과 무관하게 lineage 화살표는 한 방향(child → parent).
-- - 부모 컬렉션이 삭제되면 lineage 도 끊는다(`ON DELETE SET NULL`) — 자식 행 자체는 유지.
-- - 자기 자신 참조 금지(`CHECK`).
-- - 추천/정렬 score 에는 영향 X. UI 라벨/lightweight count 만 사용.
--
-- 정책: child 행 RLS 가 visibility/소유자 기준으로 이미 가려 주므로 별도 정책은 추가하지 않는다.
-- parent 라벨/카운트 조회는 `collections_select_public_or_own` 정책을 그대로 따른다(비공개 부모는 보이지 않음).

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS remixed_from_collection_id UUID
    REFERENCES public.collections (id) ON DELETE SET NULL;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collections_remixed_from_not_self'
      AND conrelid = 'public.collections'::regclass
  ) THEN
    ALTER TABLE public.collections
      ADD CONSTRAINT collections_remixed_from_not_self
      CHECK (remixed_from_collection_id IS NULL OR remixed_from_collection_id <> id);
  END IF;
END
$do$;

COMMENT ON COLUMN public.collections.remixed_from_collection_id IS
  '리믹스 lineage. 이 컬렉션이 어떤 다른 컬렉션을 기반으로 만들어졌는지 한 단계 부모만 기록(NULL 허용). ON DELETE SET NULL.';

-- "이 코스를 바탕으로 만들어진 코스 N개" 카운트용 인덱스. 부모 id 로 자주 그루핑/카운팅한다.
CREATE INDEX IF NOT EXISTS idx_collections_remixed_from
  ON public.collections (remixed_from_collection_id)
  WHERE remixed_from_collection_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
