-- 컬렉션 장소에 "코스 스텝 라벨"(step_label) 추가.
--
-- 기존 order_index 구조는 그대로 유지한다. step_label 은 nullable text 로,
-- 사용자가 "1차 / 2차 / 디저트 / 야장 / 마무리" 같은 자유 라벨을 붙여
-- 단순 리스트가 아닌 코스 흐름으로 보여주기 위한 보조 컬럼이다.
--
-- 빈 문자열은 NULL 로 정규화하기 위해 trim 결과가 0 이면 NULL 로 통일하는
-- BEFORE INSERT/UPDATE 트리거를 함께 둔다(클라이언트 검증을 보조).
--
-- RLS 는 부모 collection_places 정책을 그대로 따른다(별도 정책 변경 없음).

ALTER TABLE public.collection_places
  ADD COLUMN IF NOT EXISTS step_label TEXT;

ALTER TABLE public.collection_places
  DROP CONSTRAINT IF EXISTS collection_places_step_label_len_chk;
ALTER TABLE public.collection_places
  ADD CONSTRAINT collection_places_step_label_len_chk
  CHECK (
    step_label IS NULL
    OR char_length(step_label) <= 24
  );

COMMENT ON COLUMN public.collection_places.step_label IS
  '코스 흐름용 자유 라벨(예: 1차/2차/디저트/야장/마무리). 비우면 UI 숨김. 최대 24자.';

CREATE OR REPLACE FUNCTION public.collection_places_normalize_step_label()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.step_label IS NOT NULL THEN
    NEW.step_label := NULLIF(btrim(NEW.step_label), '');
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS collection_places_normalize_step_label_trg
  ON public.collection_places;
CREATE TRIGGER collection_places_normalize_step_label_trg
  BEFORE INSERT OR UPDATE OF step_label ON public.collection_places
  FOR EACH ROW
  EXECUTE FUNCTION public.collection_places_normalize_step_label();

NOTIFY pgrst, 'reload schema';
