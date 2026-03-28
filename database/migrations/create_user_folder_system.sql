-- 유저 폴더 시스템을 위한 마이그레이션 SQL
-- 6개 고정 시스템 폴더 + 사용자 저장 구조

-- 1. 시스템 폴더 정의 테이블
CREATE TABLE IF NOT EXISTS system_folders (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 사용자 저장 장소 테이블
CREATE TABLE IF NOT EXISTS user_saved_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    first_saved_from TEXT DEFAULT 'home', -- 'home', 'studio', 'search' 등
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 중복 저장 방지
    UNIQUE(user_id, place_id)
);

-- 3. 사용자 저장 장소-폴더 연결 테이블
CREATE TABLE IF NOT EXISTS user_saved_place_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_saved_place_id UUID NOT NULL REFERENCES user_saved_places(id) ON DELETE CASCADE,
    folder_key TEXT NOT NULL REFERENCES system_folders(key),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 중복 폴더 지정 방지
    UNIQUE(user_saved_place_id, folder_key)
);

-- 4. 시스템 폴더 초기 데이터
INSERT INTO system_folders (key, name, color, icon, description, sort_order) VALUES
    ('after_party', '2차', '#FF8C42', '🍺', '2차 갈 장소', 1),
    ('date', '데이트', '#FF69B4', '💘', '데이트하기 좋은 장소', 2),
    ('hangover', '해장', '#87CEEB', '🥣', '해장하기 좋은 장소', 3),
    ('solo', '혼술', '#9B59B6', '👤', '혼술하기 좋은 장소', 4),
    ('group', '회식', '#F1C40F', '👥', '단체 모임 장소', 5),
    ('must_go', '찐맛집', '#27AE60', '🌟', '꼭 가봐야 할 맛집', 6),
    ('terrace', '야외/뷰', '#2C3E50', '🌅', '야외 좌석이나 뷰가 좋은 장소', 7)
ON CONFLICT (key) DO NOTHING;

-- 5. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_saved_places_user_id ON user_saved_places(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_places_place_id ON user_saved_places(place_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_places_created_at ON user_saved_places(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_saved_place_folders_saved_place_id ON user_saved_place_folders(user_saved_place_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_place_folders_folder_key ON user_saved_place_folders(folder_key);
CREATE INDEX IF NOT EXISTS idx_user_saved_place_folders_user_folder ON user_saved_place_folders(user_saved_place_id, folder_key);

-- 6. RLS (Row Level Security) 정책
-- user_saved_places 테이블
ALTER TABLE user_saved_places ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 저장 장소만 접근 가능
CREATE POLICY "Users can view their own saved places" ON user_saved_places
    FOR SELECT USING (
        auth.uid() = user_id
    );

CREATE POLICY "Users can insert their own saved places" ON user_saved_places
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY "Users can update their own saved places" ON user_saved_places
    FOR UPDATE USING (
        auth.uid() = user_id
    );

CREATE POLICY "Users can delete their own saved places" ON user_saved_places
    FOR DELETE USING (
        auth.uid() = user_id
    );

-- user_saved_place_folders 테이블
ALTER TABLE user_saved_place_folders ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 폴더 연결만 접근 가능
CREATE POLICY "Users can view their own place folders" ON user_saved_place_folders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_saved_places usp
            WHERE usp.id = user_saved_place_folders.user_saved_place_id
            AND usp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own place folders" ON user_saved_place_folders
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_saved_places usp
            WHERE usp.id = user_saved_place_folders.user_saved_place_id
            AND usp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own place folders" ON user_saved_place_folders
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_saved_places usp
            WHERE usp.id = user_saved_place_folders.user_saved_place_id
            AND usp.user_id = auth.uid()
        )
    );

-- system_folders 테이블 (모두가 읽기 가능)
ALTER TABLE system_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view system folders" ON system_folders
    FOR SELECT USING (is_active = true);

-- 7. 유용한 함수들

-- 사용자가 장소를 저장하는 함수
CREATE OR REPLACE FUNCTION save_place_to_folders(
    p_user_id UUID,
    p_place_id UUID,
    p_folder_keys TEXT[],
    p_first_saved_from TEXT DEFAULT 'home'
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    saved_place_id UUID
) AS $$
DECLARE
    v_saved_place_id UUID;
    v_folder_key TEXT;
BEGIN
    -- 1. 장소 저장 (UPSERT)
    INSERT INTO user_saved_places (user_id, place_id, first_saved_from)
    VALUES (p_user_id, p_place_id, p_first_saved_from)
    ON CONFLICT (user_id, place_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_saved_place_id;
    
    -- 2. 폴더 연결 (기존 연결 삭제 후 새로 추가)
    DELETE FROM user_saved_place_folders 
    WHERE user_saved_place_id = v_saved_place_id;
    
    -- 3. 새 폴더 연결 추가
    FOREACH v_folder_key IN ARRAY p_folder_keys
    LOOP
        INSERT INTO user_saved_place_folders (user_saved_place_id, folder_key)
        VALUES (v_saved_place_id, v_folder_key);
    END LOOP;
    
    RETURN QUERY SELECT true, 'Successfully saved', v_saved_place_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, SQLERRM, NULL::UUID;
END;
$$ LANGUAGE plpgsql;

-- 사용자의 저장된 장소 목록 조회 함수
CREATE OR REPLACE FUNCTION get_user_saved_places_with_folders(
    p_user_id UUID
)
RETURNS TABLE (
    place_id UUID,
    place_name TEXT,
    place_lat DECIMAL,
    place_lng DECIMAL,
    saved_at TIMESTAMP WITH TIME ZONE,
    folder_keys TEXT[],
    folder_names TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.lat,
        p.lng,
        usp.created_at,
        ARRAY_AGG(DISTINCT uspf.folder_key) as folder_keys,
        ARRAY_AGG(DISTINCT sf.name) as folder_names
    FROM user_saved_places usp
    JOIN places p ON usp.place_id = p.id
    LEFT JOIN user_saved_place_folders uspf ON usp.id = uspf.user_saved_place_id
    LEFT JOIN system_folders sf ON uspf.folder_key = sf.key
    WHERE usp.user_id = p_user_id
    GROUP BY p.id, p.name, p.lat, p.lng, usp.created_at
    ORDER BY usp.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. 데이터 확인 쿼리
SELECT 
    sf.key,
    sf.name,
    sf.color,
    sf.icon,
    sf.sort_order
FROM system_folders sf
WHERE sf.is_active = true
ORDER BY sf.sort_order;

-- 9. 샘플 사용법 (주석 처리)
/*
-- 장소 저장 예시
SELECT save_place_to_folders(
    'user-uuid-here',
    'place-uuid-here',
    ARRAY['solo', 'date'],
    'home'
);

-- 사용자 저장 목록 조회 예시
SELECT * FROM get_user_saved_places_with_folders('user-uuid-here');
*/
