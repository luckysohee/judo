// 사용자 선호도 저장 및 관리 유틸리티

// 사용자 온보딩 답변 저장
export const saveUserPreferences = async (userId, preferences) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        favorite_alcohol: preferences.favorite_alcohol,
        preferred_vibes: preferences.preferred_vibe || [],
        preferred_regions: preferences.preferred_regions || [],
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('❌ 사용자 선호도 저장 오류:', error);
      return { success: false, error };
    }

    console.log('✅ 사용자 선호도 저장 성공:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ 사용자 선호도 저장 중 예외:', error);
    return { success: false, error };
  }
};

// 사용자 선호도 조회
export const getUserPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ 사용자 선호도 조회 오류:', error);
      return { success: false, error };
    }

    console.log('✅ 사용자 선호도 조회 성공:', data);
    return { success: true, data: data || {} };
  } catch (error) {
    console.error('❌ 사용자 선호도 조회 중 예외:', error);
    return { success: false, error };
  }
};

// 개인화된 검색 가중치 계산
export const getPersonalizedWeights = (preferences) => {
  const baseWeights = {
    region: 5,
    alcohol: 5,
    vibe: 4,
    purpose: 3,
    food: 2,
    curator_save: 2,
    multi_curator: 3,
    tag_match: 1
  };

  // 사용자 선호도에 따라 가중치 조정
  const personalizedWeights = { ...baseWeights };

  // 좋아하는 주종 가중치 증가
  if (preferences.favorite_alcohol) {
    personalizedWeights.alcohol = baseWeights.alcohol + 2;
  }

  // 선호하는 분위기 가중치 증가
  if (preferences.preferred_vibes && preferences.preferred_vibes.length > 0) {
    personalizedWeights.vibe = baseWeights.vibe + 1;
  }

  // 선호하는 지역 가중치 증가
  if (preferences.preferred_regions && preferences.preferred_regions.length > 0) {
    personalizedWeights.region = baseWeights.region + 1;
  }

  return personalizedWeights;
};

// 개인화된 검색 결과 생성
export const getPersonalizedSearchResults = (places, query, preferences) => {
  const weights = getPersonalizedWeights(preferences);
  
  return places.map(place => {
    let score = 0;
    const reasons = [];

    // 지역 일치 (선호 지역 가중치 적용)
    if (preferences.preferred_regions?.some(region => 
        place.address?.includes(region) || place.name?.includes(region))) {
      score += weights.region;
      reasons.push('선호 지역');
    }

    // 주종 일치 (좋아하는 주종 가중치 적용)
    if (preferences.favorite_alcohol && 
        (place.category_name?.includes(preferences.favorite_alcohol) || 
         place.name?.includes(preferences.favorite_alcohol))) {
      score += weights.alcohol;
      reasons.push('좋아하는 주종');
    }

    // 분위기 일치 (선호 분위기 가중치 적용)
    if (preferences.preferred_vibes?.some(vibe => 
        place.tags?.includes(vibe) || place.category_name?.includes(vibe))) {
      score += weights.vibe;
      reasons.push('선호 분위기');
    }

    return {
      ...place,
      personalizedScore: score,
      personalizedReasons: reasons
    };
  }).sort((a, b) => b.personalizedScore - a.personalizedScore);
};

// 온보딩 완료 여부 확인
export const hasCompletedOnboarding = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('favorite_alcohol')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ 온보딩 완료 여부 확인 오류:', error);
      return false;
    }

    // favorite_alcohol이 있으면 온보딩 완료로 간주
    return data?.favorite_alcohol ? true : false;
  } catch (error) {
    console.error('❌ 온보딩 완료 여부 확인 중 예외:', error);
    return false;
  }
};
