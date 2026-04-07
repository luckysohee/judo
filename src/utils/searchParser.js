// 룰 기반 검색 파서 - 자연어를 필터로 변환

// 지역 키워드 사전
const REGION_KEYWORDS = {
  '강남': ['강남', '강남구', '강남역', '신사', '압구정', '청담', '논현'],
  '홍대': ['홍대', '홍대입구', '합정', '상수', '망원'],
  '성수': ['성수', '성수역', '성수동', '서울숲', '뚝섬'],
  '을지로': ['을지로', '을지로입구', '을지로3가', '을지로4가', '을지로5가', '동대문'],
  '종로': ['종로', '종로3가', '종로5가', '광화문', '시청', '서울역'],
  '명동': ['명동', '명동입구', '회현', '충무로'],
  '신촌': ['신촌', '이대', '아현', '공덕'],
  '잠실': ['잠실', '잠실역', '송파', '문정', '복정'],
  '부산': ['부산', '서면', '해운대', '광안리', '남포동'],
  '대구': ['대구', '동성로', '중앙로', '반월당'],
  '제주': ['제주', '제주시', '애월', '협재', '성산']
};

// 주종 키워드 사전
const ALCOHOL_KEYWORDS = {
  '소주': ['소주', '새로', '참이슬', '시원', '한잔'],
  '맥주': ['맥주', '생맥', '수제맥', '크래프트', 'draft', '페일에일', 'IPA'],
  '와인': ['와인', '레드와인', '화이트와인', 'wine', '잔', '보르도', '부르고뉴'],
  '하이볼': ['하이볼', '칵테일', '진토닉', '모히토', '맥주콜라', '위스키'],
  '양주': ['양주', '위스키', '진', '보드카', '럼', '테킬라'],
  '사케': ['사케', '청주', '일본술'],
  '막걸리': ['막걸리', '탁주', '생막걸리', '전주'],
  '전통주': ['전통주', '한국주', '소곡주', '약주']
};

// 상황 키워드 사전
const SITUATION_KEYWORDS = {
  '1차': ['1차', '첫차', '첫잔', '시작'],
  '2차': ['2차', '이차', '둘째잔', '뒷풀이', 'after'],
  '데이트': ['데이트', '연인', '커플', '둘만', '로맨틱'],
  '회식': ['회식', '동료', '직장', '팀', '부서', '석식'],
  '혼술': ['혼술', '혼자', '나만', 'solo', '싱글'],
  '생일': ['생일', '생일파티', 'birthday', '축하'],
  '기념일': ['기념일', 'anniversary', '축하', '기념'],
  '모임': ['모임', '친구', '지인', '손님', '만남']
};

// 분위기 키워드 사전
const VIBE_KEYWORDS = {
  '조용한': ['조용한', '조용', '차분한', '얌전한', 'quiet', '편안한'],
  '시끌벅적': ['시끌벅적', '시끌', '활기', 'lively', 'noisy', '북적'],
  '감성': ['감성', '감성적', '분위기', '인스타', '예쁜', '아기자기'],
  '트렌디': ['트렌디', 'trendy', '힙', 'cool', '유행'],
  '클래식': ['클래식', 'classic', '전통', '원조', '오래된'],
  '락바': ['락바', 'rock', '음악', 'band', 'live'],
  '재즈': ['재즈', 'jazz', '爵士', '앰비언트'],
  '이국적': ['이국적', 'exotic', '외국', '해외']
};

// 음식 키워드 사전
const FOOD_KEYWORDS = {
  '해산물': ['해산물', '생선', '조개', '게', '새우', '낙지', '오징어', '문어', '전복', '꽁치'],
  '육류': ['고기', '육류', '소고기', '돼지고기', '닭고기', '갈비', '삼겹살', '목살', '닭갈비'],
  '한식': ['한식', '한국', '김치', '비빔밥', '불고기', '갈비', '된장', '순두부'],
  '일식': ['일식', '일본', '초밥', '사시미', '라멘', '우동', '돈까스', '덮밥'],
  '중식': ['중식', '중국', '짜장', '짬뽕', '볶음밥', '마라', '꿔바로우'],
  '양식': ['양식', '서양', '스테이크', '파스타', '피자', '리조또', '샐러드'],
  '분식': ['분식', '떡볶이', '순대', '김밥', '라면', '튀김', '호떡'],
  '카페': ['카페', 'coffee', '디저트', '케이크', '빵', 'pastry'],
  '해장': ['해장', '숙취', '해장국', '콩나물', '북엇국', '순대국', '뼈해장']
};

// 메인 파서 함수
export function parseSearchQuery(query) {
  const lowerQuery = query.toLowerCase().trim();
  const result = {
    region: null,
    alcohol: null,
    situation: null,
    vibe: null,
    food: null,
    keywords: [],
    confidence: 0
  };

  let matchCount = 0;

  // 지역 파싱
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      result.region = region;
      result.keywords.push(region);
      matchCount++;
      break;
    }
  }

  // 주종 파싱
  for (const [alcohol, keywords] of Object.entries(ALCOHOL_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      result.alcohol = alcohol;
      result.keywords.push(alcohol);
      matchCount++;
      break;
    }
  }

  // 상황 파싱
  for (const [situation, keywords] of Object.entries(SITUATION_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      result.situation = situation;
      result.keywords.push(situation);
      matchCount++;
      break;
    }
  }

  // 분위기 파싱
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      result.vibe = vibe;
      result.keywords.push(vibe);
      matchCount++;
      break;
    }
  }

  // 음식 파싱
  for (const [food, keywords] of Object.entries(FOOD_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      result.food = food;
      result.keywords.push(food);
      matchCount++;
      break;
    }
  }

  // 신뢰도 계산 (매치된 키워드 수 / 전체 가능 카테고리 수)
  result.confidence = matchCount / 5; // 5개 카테고리 기준

  return result;
}

// 필터 칩 생성 함수
export function createFilterChips(parsedResult) {
  const chips = [];
  
  if (parsedResult.region) {
    chips.push({
      type: 'region',
      icon: '📍',
      label: parsedResult.region,
      color: '#3498db'
    });
  }
  
  if (parsedResult.alcohol) {
    chips.push({
      type: 'alcohol',
      icon: '🍷',
      label: parsedResult.alcohol,
      color: '#e74c3c'
    });
  }
  
  if (parsedResult.situation) {
    chips.push({
      type: 'situation',
      icon: '🎉',
      label: parsedResult.situation,
      color: '#f39c12'
    });
  }
  
  if (parsedResult.vibe) {
    chips.push({
      type: 'vibe',
      icon: '✨',
      label: parsedResult.vibe,
      color: '#9b59b6'
    });
  }
  
  if (parsedResult.food) {
    chips.push({
      type: 'food',
      icon: '🍽️',
      label: parsedResult.food,
      color: '#2ecc71'
    });
  }
  
  return chips;
}

// 검색 요약 생성
export function createSearchSummary(parsedResult, originalQuery) {
  const matchedFilters = createFilterChips(parsedResult);
  
  if (matchedFilters.length === 0) {
    return `"${originalQuery}" 검색 결과`;
  }
  
  const filterLabels = matchedFilters.map(chip => chip.label).join(' + ');
  return `${filterLabels} 검색 결과`;
}

// 장소 스코어링 함수
export function scorePlace(place, parsedResult) {
  let score = 0;
  const reasons = [];

  // 지역 일치 (+30점)
  if (parsedResult.region && place.address && place.address.includes(parsedResult.region)) {
    score += 30;
    reasons.push(`${parsedResult.region} 지역`);
  }

  // 주종 일치 (+25점)
  if (parsedResult.alcohol) {
    if (place.category_name?.includes(parsedResult.alcohol) || 
        place.name?.includes(parsedResult.alcohol) ||
        place.tags?.includes(parsedResult.alcohol)) {
      score += 25;
      reasons.push(`${parsedResult.alcohol} 관련`);
    }
  }

  // 상황 일치 (+20점)
  if (parsedResult.situation) {
    if (place.tags?.includes(parsedResult.situation) || 
        place.category_name?.includes(parsedResult.situation)) {
      score += 20;
      reasons.push(`${parsedResult.situation}에 적합`);
    }
  }

  // 분위기 일치 (+15점)
  if (parsedResult.vibe) {
    if (place.tags?.includes(parsedResult.vibe) || 
        place.category_name?.includes(parsedResult.vibe)) {
      score += 15;
      reasons.push(`${parsedResult.vibe} 분위기`);
    }
  }

  // 음식 일치 (+10점)
  if (parsedResult.food) {
    if (place.tags?.includes(parsedResult.food) || 
        place.category_name?.includes(parsedResult.food)) {
      score += 10;
      reasons.push(`${parsedResult.food} 메뉴`);
    }
  }

  // 큐레이터 추천 보너스 (+5점)
  if (place.curatorCount > 0) {
    score += 5;
    reasons.push('큐레이터 추천');
  }

  return {
    score,
    reasons,
    matchReasons: reasons
  };
}

// 인기 검색 예시
export const SEARCH_EXAMPLES = [
  { query: '성수 2차 하이볼', icon: '🍹' },
  { query: '을지로 조용한 소주집', icon: '🥃' },
  { query: '강남 데이트 와인', icon: '🍷' },
  { query: '해산물에 술 좋은 곳', icon: '🦐' },
  { query: '홍대 락바 혼술', icon: '🎸' },
  { query: '종로 전통주 모임', icon: '🍶' }
];
