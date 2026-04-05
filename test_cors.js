// CORS 문제 테스트
const KAKAO_REST_API_KEY = 'c11926540ef6a01a9447ef114af07c5d';

async function testCORS() {
  try {
    console.log('🔍 CORS 테스트 시작...');
    
    // 1. fetch로 테스트
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/detail.json?id=8725439`, {
      method: 'GET',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json'
      },
      mode: 'cors' // 명시적으로 CORS 설정
    });

    console.log('🔍 응답 상태:', response.status);
    console.log('🔍 응답 헤더:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 응답 에러:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ CORS 성공:', data);

  } catch (error) {
    console.error('❌ CORS 에러:', error);
    console.error('에러 타입:', error.name);
    console.error('에러 메시지:', error.message);
  }
}

// 브라우저 콘솔에서 실행
testCORS();
