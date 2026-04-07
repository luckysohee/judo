-- search_logs 테이블에 사용자 타입 컬럼 추가
ALTER TABLE search_logs 
ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'anonymous';

-- place_click_logs 테이블에 사용자 타입 컬럼 추가
ALTER TABLE place_click_logs 
ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'anonymous';

-- 기존 데이터 업데이트 (user_id가 'anonymous'이 아닌 경우)
UPDATE search_logs 
SET 
  is_logged_in = true,
  user_type = 'registered'
WHERE user_id != 'anonymous' AND user_id IS NOT NULL;

UPDATE place_click_logs 
SET 
  is_logged_in = true,
  user_type = 'registered'
WHERE user_id != 'anonymous' AND user_id IS NOT NULL;

-- 기존 익명 데이터 업데이트
UPDATE search_logs 
SET 
  is_logged_in = false,
  user_type = 'anonymous'
WHERE user_id = 'anonymous' OR user_id IS NULL;

UPDATE place_click_logs 
SET 
  is_logged_in = false,
  user_type = 'anonymous'
WHERE user_id = 'anonymous' OR user_id IS NULL;

-- 확인 쿼리
SELECT 'search_logs' as table_name, user_type, COUNT(*) as count 
FROM search_logs 
GROUP BY user_type
UNION ALL
SELECT 'place_click_logs' as table_name, user_type, COUNT(*) as count 
FROM place_click_logs 
GROUP BY user_type;
