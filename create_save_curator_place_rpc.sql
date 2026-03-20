-- save_curator_place RPC 함수 생성
CREATE OR REPLACE FUNCTION save_curator_place(
    p_curator_id UUID,
    p_name TEXT,
    p_address TEXT,
    p_latitude FLOAT,
    p_longitude FLOAT,
    p_phone TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_alcohol_type TEXT DEFAULT NULL,
    p_atmosphere TEXT DEFAULT NULL,
    p_recommended_menu TEXT DEFAULT NULL,
    p_menu_reason TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_image TEXT DEFAULT NULL,
    p_one_line_review TEXT DEFAULT NULL,
    p_visit_situations TEXT[] DEFAULT NULL,
    p_price_range TEXT DEFAULT NULL,
    p_visit_tips TEXT DEFAULT NULL,
    p_is_public BOOLEAN DEFAULT false,
    p_is_featured BOOLEAN DEFAULT false
)
RETURNS TABLE (
    success BOOLEAN,
    place_id UUID,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_place_id UUID;
    v_curator_id UUID;
BEGIN
    -- UUID 자동 생성
    v_place_id := gen_random_uuid();
    
    -- 큐레이터 ID 확인 (임시로 ID를 그대로 사용)
    -- 실제로는 curators 테이블에서 user_id로 큐레이터 ID를 찾아야 함
    v_curator_id := p_curator_id;
    
    -- 장소 추가
    INSERT INTO places (
        id, name, address, region, lat, lng, comment, tags, 
        primary_curator_id, saved_count, created_at, image
    ) VALUES (
        v_place_id, p_name, p_address, '지정안됨', p_latitude, p_longitude, 
        p_one_line_review, p_tags, v_curator_id, 0, NOW(), p_image
    );
    
    RETURN QUERY SELECT true, v_place_id, '장소가 성공적으로 추가되었습니다.';
END;
$$;

-- 함수 권한 부여
GRANT EXECUTE ON FUNCTION save_curator_place TO authenticated;
GRANT EXECUTE ON FUNCTION save_curator_place TO anon;
