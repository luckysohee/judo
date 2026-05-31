// JSONP 테스트
function testJSONP() {
  const callbackName = `kakaoCallback_${Date.now()}`;
  
  // 전역 콜백 함수 설정
  window[callbackName] = (data) => {
    console.log('✅ JSONP 성공:', data);
    delete window[callbackName];
    document.head.removeChild(script);
  };

  // JSONP 요청 생성
  const script = document.createElement('script');
  script.src = `https://dapi.kakao.com/v2/local/search/detail.json?id=8725439&appkey=c11926540ef6a01a9447ef114af07c5d&callback=${callbackName}`;
  
  // 에러 핸들링
  script.onerror = () => {
    console.error('❌ JSONP 실패');
    delete window[callbackName];
    document.head.removeChild(script);
  };

  // 스크립트 추가
  document.head.appendChild(script);
}

// 브라우저 콘솔에서 실행
testJSONP();
