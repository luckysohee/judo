-- kakao_place_id 필드 추가 마이그레이션
-- 카카오 장소 ID를 저장하기 위한 필드 추가

ALTER TABLE places 
ADD COLUMN IF NOT EXISTS kakao_place_id TEXT;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_places_kakao_place_id ON places(kakao_place_id);

-- 고유 제약조건 추가 (부분 인덱스 사용 - NULL 값 제외)
CREATE UNIQUE INDEX IF NOT EXISTS unique_kakao_place_id ON places(kakao_place_id) WHERE kakao_place_id IS NOT NULL;
