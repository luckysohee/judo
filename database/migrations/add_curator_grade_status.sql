-- 큐레이터 등급/상태 시스템을 위한 마이그레이션 SQL

-- 1. curators 테이블에 grade 필드 추가 (없는 경우)
ALTER TABLE curators 
ADD COLUMN IF NOT EXISTS grade TEXT DEFAULT 'bronze' CHECK (grade IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));

-- 2. curators 테이블에 status 필드 추가 (없는 경우)
ALTER TABLE curators 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'warning', 'suspended', 'inactive'));

-- 3. curators 테이블에 추가 정보 필드 (선택적)
ALTER TABLE curators 
ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;

ALTER TABLE curators 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE curators 
ADD COLUMN IF NOT EXISTS total_places INTEGER DEFAULT 0;

ALTER TABLE curators 
ADD COLUMN IF NOT EXISTS total_likes INTEGER DEFAULT 0;

-- 4. 기존 큐레이터 데이터 초기화 (grade와 status가 NULL인 경우)
UPDATE curators 
SET grade = 'bronze', status = 'active' 
WHERE grade IS NULL OR status IS NULL;

-- 5. 등급별 기준 설정을 위한 함수 (선택적)
-- 이 함수는 주기적으로 실행하여 큐레이터 등급을 자동으로 조정할 수 있습니다
CREATE OR REPLACE FUNCTION update_curator_grade()
RETURNS TRIGGER AS $$
BEGIN
    -- 등급 자동 조정 로직 (상향 조정된 기준)
    -- 브론즈: 50-99 장소
    -- 실버: 100-199 장소  
    -- 골드: 200-499 장소
    -- 플래티넘: 500-999 장소
    -- 다이아몬드: 1000+ 장소
    
    IF NEW.total_places >= 1000 THEN
        NEW.grade = 'diamond';
    ELSIF NEW.total_places >= 500 THEN
        NEW.grade = 'platinum';
    ELSIF NEW.total_places >= 200 THEN
        NEW.grade = 'gold';
    ELSIF NEW.total_places >= 100 THEN
        NEW.grade = 'silver';
    ELSE
        NEW.grade = 'bronze';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 등급 자동 업데이트 트리거 (선택적)
-- DROP TRIGGER IF EXISTS auto_update_curator_grade ON curators;
-- CREATE TRIGGER auto_update_curator_grade
--     BEFORE UPDATE OF total_places ON curators
--     FOR EACH ROW
--     EXECUTE FUNCTION update_curator_grade();

-- 7. RLS 정책 업데이트 (Admin만 grade/status 수정 가능)
-- 기존 정책이 있다면 삭제 후 새로 생성
DROP POLICY IF EXISTS "Admins can update curator grade and status" ON curators;

CREATE POLICY "Admins can update curator grade and status" ON curators
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'admin' OR 
        (EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        ))
    );

-- 8. 큐레이터 본인은 자신의 정보만 조회 가능 (기존 정책 유지)
-- 이 정책은 이미 있을 가능성이 높음

-- 9. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_curators_grade ON curators(grade);
CREATE INDEX IF NOT EXISTS idx_curators_status ON curators(status);
CREATE INDEX IF NOT EXISTS idx_curators_total_places ON curators(total_places DESC);

-- 10. 샘플 데이터 확인 쿼리
SELECT 
    c.username,
    c.grade,
    c.status,
    c.total_places,
    c.total_likes,
    c.warning_count,
    c.created_at
FROM curators c
ORDER BY c.created_at DESC;
