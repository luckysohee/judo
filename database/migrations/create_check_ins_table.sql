-- check_ins 테이블 생성
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_nickname VARCHAR(100) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  place_name VARCHAR(255) NOT NULL,
  place_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_check_ins_place_id ON check_ins(place_id);
CREATE INDEX idx_check_ins_created_at ON check_ins(created_at DESC);

-- Realtime 활성화
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (모든 사용자가 읽기 가능, 체크인은 인증된 사용자만 가능)
CREATE POLICY "Enable read access for all users" ON check_ins FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON check_ins FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 기존 chekins 테이블이 있다면 삭제 (선택적)
-- DROP TABLE IF EXISTS chekins;
