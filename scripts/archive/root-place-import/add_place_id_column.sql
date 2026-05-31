-- places 테이블에 place_id 컬럼 추가
ALTER TABLE places ADD COLUMN place_id VARCHAR(50);

-- 기존 데이터에 place_id 업데이트 (카카오 ID로)
-- 이 부분은 기존 데이터가 있다면 수동으로 업데이트 필요

-- 인덱스 추가 (성능 향상)
CREATE INDEX idx_places_place_id ON places(place_id);
