-- 컬렉션 상황 태그 (데이트 / 야장 / 소개팅 / 노포 / 혼술 / 새벽 등).
-- 클라이언트는 preset + 자유입력 혼합으로 다루지만 DB 는 단순 text[] 로만 유지한다.
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS tags TEXT[] NULL;

COMMENT ON COLUMN public.collections.tags IS
  '상황 태그(데이트·야장·노포 등). NULL/[] 둘 다 비어 있음으로 취급. preset + 자유입력 혼합. 길이/개수 제한은 클라이언트에서 정규화.';

-- 태그 기반 홈 레일·검색 groundwork. && (overlaps) / @> 등 PostgREST `cs` / `ov` 와 호환.
CREATE INDEX IF NOT EXISTS idx_collections_tags_gin
  ON public.collections USING GIN (tags)
  WHERE visibility = 'public';

NOTIFY pgrst, 'reload schema';
