// 카카오 장소 상세 정보 API 호출 유틸리티

const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

// place_id로 카카오 장소 상세 정보 가져오기
export async function getKakaoPlaceDetails(placeId) {
  try {
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/detail.json?id=${placeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.documents && data.documents.length > 0) {
      return data.documents[0];
    }
    
    return null;
  } catch (error) {
    console.error('카카오 장소 상세 정보 조회 실패:', error);
    return null;
  }
}

// place_id로 카카오 장소 기본 정보 가져오기
export async function getKakaoPlaceBasicInfo(placeId) {
  const details = await getKakaoPlaceDetails(placeId);
  
  if (!details) {
    return null;
  }

  return {
    place_name: details.place_name,
    place_id: details.id,
    address: details.address_name || details.road_address_name,
    phone: details.phone,
    category_group_name: details.category_group_name,
    category_name: details.category_name,
    x: details.x,
    y: details.y,
    place_url: details.place_url,
    rating: details.rating || 0,
    review_count: details.review_count || 0
  };
}
