// 🤖 추천 알고리즘 v1 (룰 기반 MVP)

// 🎯 추천 점수 계산
export const calculateRecommendationScore = (place, userPreferences) => {
  let score = 0;
  
  // +3 동일 주종
  if (userPreferences.preferredAlcohol && place.alcohol_type === userPreferences.preferredAlcohol) {
    score += 3;
  }
  
  // +3 동일 분위기
  if (userPreferences.preferredAtmosphere && place.atmosphere === userPreferences.preferredAtmosphere) {
    score += 3;
  }
  
  // +2 동일 카테고리
  if (userPreferences.preferredCategory && place.category === userPreferences.preferredCategory) {
    score += 2;
  }
  
  // +2 동일 상황 태그
  if (userPreferences.preferredTags && userPreferences.preferredTags.length > 0) {
    const matchingTags = (place.tags || []).filter(tag => 
      userPreferences.preferredTags.includes(tag)
    );
    score += matchingTags.length * 2;
  }
  
  // +1 인기 (저장 수)
  if (place.save_count) {
    score += Math.min(place.save_count / 10, 5); // 최대 5점
  }
  
  // +1 최근성 (최근 30일 내)
  const daysSinceCreated = (new Date() - new Date(place.created_at)) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated <= 30) {
    score += 1;
  }
  
  return score;
};

// 🔍 사용자 선호도 분석
export const analyzeUserPreferences = (userActions) => {
  const preferences = {
    preferredAlcohol: null,
    preferredAtmosphere: null,
    preferredCategory: null,
    preferredTags: []
  };
  
  // 주종 선호도 분석
  const alcoholCounts = {};
  userActions.forEach(action => {
    if (action.place && action.place.alcohol_type) {
      alcoholCounts[action.place.alcohol_type] = (alcoholCounts[action.place.alcohol_type] || 0) + 1;
    }
  });
  
  const topAlcohol = Object.entries(alcoholCounts)
    .sort(([,a], [,b]) => b - a)[0];
  if (topAlcohol && topAlcohol[1] >= 2) {
    preferences.preferredAlcohol = topAlcohol[0];
  }
  
  // 분위기 선호도 분석
  const atmosphereCounts = {};
  userActions.forEach(action => {
    if (action.place && action.place.atmosphere) {
      atmosphereCounts[action.place.atmosphere] = (atmosphereCounts[action.place.atmosphere] || 0) + 1;
    }
  });
  
  const topAtmosphere = Object.entries(atmosphereCounts)
    .sort(([,a], [,b]) => b - a)[0];
  if (topAtmosphere && topAtmosphere[1] >= 2) {
    preferences.preferredAtmosphere = topAtmosphere[0];
  }
  
  // 카테고리 선호도 분석
  const categoryCounts = {};
  userActions.forEach(action => {
    if (action.place && action.place.category) {
      categoryCounts[action.place.category] = (categoryCounts[action.place.category] || 0) + 1;
    }
  });
  
  const topCategory = Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)[0];
  if (topCategory && topCategory[1] >= 2) {
    preferences.preferredCategory = topCategory[0];
  }
  
  // 태그 선호도 분석
  const tagCounts = {};
  userActions.forEach(action => {
    if (action.place && action.place.tags) {
      action.place.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  
  preferences.preferredTags = Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5) // 상위 5개 태그
    .map(([tag]) => tag);
  
  return preferences;
};

// 📝 추천 결과 생성
export const generateRecommendations = (places, userPreferences, limit = 20) => {
  // 점수 계산
  const scoredPlaces = places.map(place => ({
    ...place,
    recommendationScore: calculateRecommendationScore(place, userPreferences)
  }));
  
  // 점수순 정렬
  const sortedPlaces = scoredPlaces.sort((a, b) => b.recommendationScore - a.recommendationScore);
  
  // 상위 N개 반환
  return sortedPlaces.slice(0, limit);
};

// 🎯 유사한 큐레이터 찾기
export const findSimilarCurators = (curatorId, allCurators, userActions) => {
  const curatorPlaces = userActions
    .filter(action => action.curator_id === curatorId)
    .map(action => action.place_id);
  
  const similarities = allCurators.map(curator => {
    if (curator.id === curatorId) return { curator, similarity: 0 };
    
    const otherPlaces = userActions
      .filter(action => action.curator_id === curator.id)
      .map(action => action.place_id);
    
    const intersection = curatorPlaces.filter(placeId => otherPlaces.includes(placeId));
    const union = [...new Set([...curatorPlaces, ...otherPlaces])];
    
    const similarity = intersection.length / union.length; // Jaccard similarity
    
    return { curator, similarity };
  });
  
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .filter(item => item.similarity > 0)
    .slice(0, 5);
};

// 🔄 함께 저장된 장소 찾기
export const findCoSavedPlaces = (placeId, userActions) => {
  const usersWhoSaved = userActions
    .filter(action => action.place_id === placeId)
    .map(action => action.user_id);
  
  const coSavedPlaces = {};
  
  usersWhoSaved.forEach(userId => {
    const userSavedPlaces = userActions
      .filter(action => action.user_id === userId && action.place_id !== placeId)
      .map(action => action.place_id);
    
    userSavedPlaces.forEach(savedPlaceId => {
      coSavedPlaces[savedPlaceId] = (coSavedPlaces[savedPlaceId] || 0) + 1;
    });
  });
  
  return Object.entries(coSavedPlaces)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([placeId, count]) => ({ placeId, coSaveCount: count }));
};

// 📊 큐레이터 등급 계산
export const calculateCuratorLevel = (curatorStats) => {
  const { placeCount, saveCount, followerCount } = curatorStats;
  
  if (placeCount >= 50 && saveCount >= 1000 && followerCount >= 100) {
    return {
      level: 4,
      title: "Top Curator",
      description: "최상위 큐레이터",
      requirements: "잔 50개+, 저장 1000+, 팔로워 100+"
    };
  }
  
  if (placeCount >= 20 && saveCount >= 100) {
    return {
      level: 3,
      title: "Trusted Curator", 
      description: "신뢰할 수 있는 큐레이터",
      requirements: "잔 20개+, 저장 100+"
    };
  }
  
  if (placeCount >= 10) {
    return {
      level: 2,
      title: "Local Curator",
      description: "지역 전문 큐레이터", 
      requirements: "잔 10개+"
    };
  }
  
  return {
    level: 1,
    title: "New Drinker",
    description: "새로운 큐레이터",
    requirements: "시작 단계"
  };
};
