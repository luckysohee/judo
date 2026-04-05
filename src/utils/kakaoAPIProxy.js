// 서버 프록시를 통한 카카오 API 호출
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export async function getKakaoPlaceDetailsViaProxy(placeId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/kakao/place-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ placeId })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.documents?.[0] || null;
  } catch (error) {
    console.error('프록시 카카오 API 호출 실패:', error);
    return null;
  }
}

export async function getKakaoPlaceBasicInfoViaProxy(placeId) {
  const details = await getKakaoPlaceDetailsViaProxy(placeId);
  
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
