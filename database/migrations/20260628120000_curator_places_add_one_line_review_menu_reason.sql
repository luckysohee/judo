-- 스키마 드리프트 수정: get_places_in_bounds RPC·서버 폴백·검색 코드가
-- curator_places.one_line_review / menu_reason 를 참조하는데 컬럼이 없어
-- 지도 bbox RPC가 42703(column cp.one_line_review does not exist)으로 매번 깨졌다.
-- → 폴백 쿼리가 큐레이터 우선순위 없이 장소를 잘라와 「을지로」 코스에
--   유명 큐레이터 술집 대신 엉뚱한 장소가 섞임.
-- 컬럼은 선택적 보조 문구(주 사유는 one_line_reason)라 빈 값 추가로 안전하게 정합화.

ALTER TABLE public.curator_places
  ADD COLUMN IF NOT EXISTS one_line_review text;

ALTER TABLE public.curator_places
  ADD COLUMN IF NOT EXISTS menu_reason text;

COMMENT ON COLUMN public.curator_places.one_line_review IS
  '선택 한 줄 리뷰(보조). 주 추천 사유는 one_line_reason.';
COMMENT ON COLUMN public.curator_places.menu_reason IS
  '선택 메뉴 추천 사유(보조).';

NOTIFY pgrst, 'reload schema';
