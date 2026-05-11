-- 컬렉션 커버 이미지 URL (선택). 업로드는 클라이언트 외부 저장소 URL 만 허용.

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.collections.cover_image_url IS
  '컬렉션 카드·상단 배너용 커버 이미지 URL. 비우면 그라데이션 플레이스홀더 사용.';

NOTIFY pgrst, 'reload schema';
