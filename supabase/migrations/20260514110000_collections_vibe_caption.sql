-- 컬렉션 한 줄 무드 카피("스토리") — 단순 장소 리스트가 아니라 "분위기" 단위로 보이게 한다.
--
-- 예: "비 오는 날 천천히 걷는 을지로", "소개팅 끝나고 자연스럽게 2차 가기 좋은 흐름".
-- 카드 title 아래 한 줄(최대 2줄 clamp)로 노출. 추천/검색 score 와는 분리.
--
-- 길이는 카드 2줄 안에 들어오도록 80자 제한. 빈 문자열·공백만은 NULL 로 정규화한다.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS vibe_caption TEXT;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collections_vibe_caption_length'
      AND conrelid = 'public.collections'::regclass
  ) THEN
    ALTER TABLE public.collections
      ADD CONSTRAINT collections_vibe_caption_length
      CHECK (
        vibe_caption IS NULL
        OR char_length(btrim(vibe_caption)) BETWEEN 1 AND 80
      );
  END IF;
END
$do$;

COMMENT ON COLUMN public.collections.vibe_caption IS
  '컬렉션 한 줄 무드(스토리). 카드 title 아래 2줄 clamp 노출용. 80자 이내, NULL 허용.';

NOTIFY pgrst, 'reload schema';
