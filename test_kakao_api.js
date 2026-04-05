// 카카오 API 테스트
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

async function testKakaoAPI() {
  try {
    // 테스트용 place_id (실제 있는 ID로 변경 필요)
    const testPlaceId = '8725439'; // 감미옥
    
    console.log('🔍 카카오 API 테스트 시작...');
    console.log('🔍 테스트 place_id:', testPlaceId);
    
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/detail.json?id=${testPlaceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 응답 상태:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API 응답 데이터:', data);
    
    if (data.documents && data.documents.length > 0) {
      const place = data.documents[0];
      console.log('✅ 장소 정보:', {
        name: place.place_name,
        phone: place.phone,
        address: place.address_name,
        category: place.category_name
      });
    } else {
      console.log('❌ 장소 정보 없음');
    }
    
  } catch (error) {
    console.error('❌ API 테스트 실패:', error);
  }
}

// 브라우저 콘솔에서 실행
testKakaoAPI();
