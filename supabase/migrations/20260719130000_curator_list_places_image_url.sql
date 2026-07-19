-- 맛집첩 장소별 사진 (큐레이터 업로드)
ALTER TABLE public.curator_list_places
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.curator_list_places.image_url IS
  '맛집첩 장소 카드용 사진 URL (Storage 공개 URL).';
