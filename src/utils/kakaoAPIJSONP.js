// JSONP를 통한 카카오 API 호출 (CORS 우회)
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5c';

export function getKakaoPlaceDetailsJSONP(placeId) {
  return new Promise((resolve, reject) => {
    // JSONP 콜백 함수 이름 생성
    const callbackName = `kakaoCallback_${Date.now()}`;
    
    // 전역 콜백 함수 설정
    window[callbackName] = (data) => {
      // 콜백 함수 정리
      delete window[callbackName];
      document.head.removeChild(script);
      
      if (data.documents && data.documents.length > 0) {
        resolve(data.documents[0]);
      } else {
        reject(new Error('장소 정보를 찾을 수 없습니다.'));
      }
    };

    // JSONP 요청 생성
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/local/search/detail.json?id=${placeId}&appkey=${KAKAO_REST_API_KEY}&callback=${callbackName}`;
    
    // 에러 핸들링
    script.onerror = () => {
      delete window[callbackName];
      document.head.removeChild(script);
      reject(new Error('JSONP 요청 실패'));
    };

    // 스크립트 추가
    document.head.appendChild(script);
    
    // 타임아웃 설정
    setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
        document.head.removeChild(script);
        reject(new Error('요청 타임아웃'));
      }
    }, 10000);
  });
}

function collectPhotoUrlsFromDetail(details) {
  if (!details || typeof details !== "object") return [];
  const out = [];
  const push = (u) => {
    if (typeof u === "string" && u.trim() && !out.includes(u)) out.push(u);
  };
  push(
    details.thumbnail_url ||
      details.thumbnail ||
      details.photo_url ||
      details.image_url
  );
  const lists = [
    details.photos,
    details.photo_urls,
    details.place_photo_list,
    details.images,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        push(item.url || item.image_url || item.thumbnail_url || item.origin_url);
      }
    }
  }
  return out;
}

export async function getKakaoPlaceBasicInfoJSONP(placeId) {
  try {
    const details = await getKakaoPlaceDetailsJSONP(placeId);
    const photo_urls = collectPhotoUrlsFromDetail(details);

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
      review_count: details.review_count || 0,
      thumbnail_url: photo_urls[0] || null,
      photo_urls,
    };
  } catch (error) {
    console.error('JSONP 카카오 API 호출 실패:', error);
    return null;
  }
}
