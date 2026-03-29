-- 유저 폴더 시스템 완전 마이그레이션
-- 기존 테이블 삭제 후 새로 생성

-- 1. 기존 테이블 삭제 (있을 경우)
DROP TABLE IF EXISTS user_saved_place_folders CASCADE;
DROP TABLE IF EXISTS user_saved_places CASCADE;
DROP TABLE IF EXISTS system_folders CASCADE;

-- 2. 시스템 폴더 정의 테이블
CREATE TABLE system_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 사용자 저장 장소 테이블 (새 구조)
CREATE TABLE user_saved_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    first_saved_from TEXT DEFAULT 'home',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 중복 저장 방지
    UNIQUE(user_id, place_id)
);

-- 4. 사용자 저장 장소-폴더 연결 테이블
CREATE TABLE user_saved_place_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_saved_place_id UUID NOT NULL REFERENCES user_saved_places(id) ON DELETE CASCADE,
    folder_key TEXT NOT NULL REFERENCES system_folders(key),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 중복 폴더 지정 방지
    UNIQUE(user_saved_place_id, folder_key)
);

-- 5. 시스템 폴더 초기 데이터
INSERT INTO system_folders (key, name, color, icon, description, sort_order) VALUES
    ('after_party', '2차', '#FF8C42', '🍺', '2차 갈 장소', 1),
    ('date', '데이트', '#FF69B4', '💘', '데이트하기 좋은 장소', 2),
    ('hangover', '해장', '#87CEEB', '🥣', '해장하기 좋은 장소', 3),
    ('solo', '혼술', '#9B59B6', '👤', '혼술하기 좋은 장소', 4),
    ('group', '회식', '#F1C40F', '👥', '회식하기 좋은 장소', 5),
    ('must_go', '찐맛집', '#27AE60', '🌟', '꼭 가봐야 할 맛집', 6),
    ('terrace', '야외/뷰', '#2C3E50', '🌅', '야외 또는 뷰가 좋은 장소', 7);

-- 6. RLS 정책 활성화
ALTER TABLE system_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_place_folders ENABLE ROW LEVEL SECURITY;

-- 7. RLS 정책 설정
-- 시스템 폴더는 모두가 읽을 수 있음
CREATE POLICY "System folders are viewable by everyone" ON system_folders FOR SELECT USING (true);

-- 사용자는 자신의 저장 장소만 CRUD 가능
CREATE POLICY "Users can view own saved places" ON user_saved_places FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved places" ON user_saved_places FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved places" ON user_saved_places FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved places" ON user_saved_places FOR DELETE USING (auth.uid() = user_id);

-- 사용자는 자신의 폴더 연결만 CRUD 가능
CREATE POLICY "Users can view own folder connections" ON user_saved_place_folders FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_saved_places WHERE id = user_saved_place_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own folder connections" ON user_saved_place_folders FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_saved_places WHERE id = user_saved_place_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update own folder connections" ON user_saved_place_folders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_saved_places WHERE id = user_saved_place_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own folder connections" ON user_saved_place_folders FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_saved_places WHERE id = user_saved_place_id AND user_id = auth.uid())
);

-- 8. 인덱스 생성
CREATE INDEX idx_user_saved_places_user_id ON user_saved_places(user_id);
CREATE INDEX idx_user_saved_places_place_id ON user_saved_places(place_id);
CREATE INDEX idx_user_saved_place_folders_place_id ON user_saved_place_folders(user_saved_place_id);
CREATE INDEX idx_user_saved_place_folders_folder_key ON user_saved_place_folders(folder_key);

-- 9. 확인 쿼리
SELECT 'system_folders' as table_name, COUNT(*) as row_count FROM system_folders
UNION ALL
SELECT 'user_saved_places' as table_name, COUNT(*) as row_count FROM user_saved_places
UNION ALL  
SELECT 'user_saved_place_folders' as table_name, COUNT(*) as row_count FROM user_saved_place_folders;

-- 완료 메시지
SELECT 'User Folder System Migration Completed Successfully!' as status;
