// API 키 유효성 테스트
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

async function testAPIKey() {
  try {
    console.log('🔍 API 키 테스트 시작...');
    console.log('🔍 사용하는 API 키:', KAKAO_REST_API_KEY);
    
    // 1. 키워드 검색 테스트 (더 간단한 API)
    const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=감미옥`, {
      method: 'GET',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    console.log('🔍 키워드 검색 응답:', keywordResponse.status);

    if (keywordResponse.ok) {
      const keywordData = await keywordResponse.json();
      console.log('✅ 키워드 검색 성공:', keywordData.documents?.[0]);
    } else {
      const errorText = await keywordResponse.text();
      console.error('❌ 키워드 검색 실패:', errorText);
      return;
    }

    // 2. 상세 검색 테스트
    const detailResponse = await fetch(`https://dapi.kakao.com/v2/local/search/detail.json?id=8725439`, {
      method: 'GET',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    console.log('🔍 상세 검색 응답:', detailResponse.status);

    if (detailResponse.ok) {
      const detailData = await detailResponse.json();
      console.log('✅ 상세 검색 성공:', detailData.documents?.[0]);
    } else {
      const errorText = await detailResponse.text();
      console.error('❌ 상세 검색 실패:', errorText);
    }

  } catch (error) {
    console.error('❌ API 테스트 실패:', error);
  }
}

// 브라우저 콘솔에서 실행
testAPIKey();
