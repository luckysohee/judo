// 자연어 검색 파싱 규칙
// AI처럼 보이게 하는 룰 기반 검색 엔진

// 지역 키워드 사전
const REGION_KEYWORDS = {
  '강남': ['강남', '강남역', '신사', '압구정', '청담', '논현'],
  '성수': ['성수', '성수역', '서울숲', '뚝섬'],
  '을지로': ['을지로', '을지로입구', '동대문', '종로5가', '동대문역'],
  '홍대': ['홍대', '홍대입구', '합정', '상수', '마포'],
  '이태원': ['이태원', '한남', '녹사평'],
  '여의도': ['여의도', '국회의사당', '여의도역'],
  '명동': ['명동', '명동역', '충무로'],
  '건대': ['건대', '건대입구', '어린이대공원', '군자'],
  '잠실': ['잠실', '잠실역', '종합운동장', '신천'],
  '신촌': ['신촌', '이대', '아현', '공덕'],
  '부산': ['부산', '서면', '해운대', '광안리', '남포동'],
  '대구': ['대구', '동성로', '반월당', '수성구'],
  '제주': ['제주', '제주시', '신제주', '구제주', '애월']
};

// 주종 키워드 사전
const ALCOHOL_KEYWORDS = {
  '소주': ['소주', '술', '한잔', '전통주'],
  '맥주': ['맥주', '생맥', '드래프트', '크래프트'],
  '와인': ['와인', '레드와인', '화이트와인', '와인바', '와인셀러'],
  '하이볼': ['하이볼', '하이볼맛집', '칵테일', '진토닉', '모히또'],
  '사케': ['사케', '청주', '일본술', '사케바'],
  '막걸리': ['막걸리', '탁주', '전통주', '약주'],
  '양주': ['위스키', '진', '럼', '보드카', '브랜디'],
  '전통주': ['전통주', '한국술', '약주', '과실주']
};

// 분위기 키워드 사전
const VIBE_KEYWORDS = {
  '조용한': ['조용한', '조용', '얌전한', '차분한', '고요한', '조용히'],
  '시끌벅적': ['시끌벅적', '시끌', '북적', '활기', '에너지', '불타는'],
  '무드있는': ['무드있는', '분위기좋은', '로맨틱', '인스타', '감성', '데이트'],
  '편안한': ['편안한', '아늑한', '편안', '휴식', '쉼', '여유'],
  '트렌디': ['트렌디', '세련된', '모던', '감성', '인스타그래머블'],
  '전통적인': ['전통적인', '노포', '오래된', '한식', '정통', '전통'],
  '가벼운': ['가벼운', '가볍게', '간단한', '간단히', '가성비']
};

// 상황/목적 키워드 사전
const PURPOSE_KEYWORDS = {
  '1차': ['1차', '첫차', '첫잔', '시작', '오프닝'],
  '2차': ['2차', '이차', '둘째잔', '뒷풀이', '뒷자리'],
  '데이트': ['데이트', '소개팅', '연인', '커플', '로맨틱'],
  '회식': ['회식', '모임', '단합', '팀', '직장'],
  '혼술': ['혼술', '혼자', '나만', '솔로', '혼밥'],
  '친구': ['친구', '친목', '동창', '친구들', '우정'],
  '가족': ['가족', '가족모임', '부모님', '자식', '가족식사']
};

// 음식 키워드 사전
const FOOD_KEYWORDS = {
  '해산물': ['해산물', '생선', '회', '굴', '조개', '새우', '게', '랍스터'],
  '육류': ['고기', '삼겹살', '갈비', '소고기', '돼지고기', '닭', '치킨'],
  '한식': ['한식', '한국음식', '전통', '김치', '비빔밥', '불고기'],
  '일식': ['일식', '초밥', '라멘', '돈까스', '우동', '일본'],
  '양식': ['양식', '스테이크', '파스타', '피자', '이탈리안', '프렌치'],
  '중식': ['중식', '중국음식', '마라탕', '짜장', '짬뽕', '중국'],
  '분식': ['분식', '떡볶이', '순대', '어묵', '김말이', '호떡']
};

// 가중치 설정 - 더 다양한 결과를 위해 조정
const WEIGHTS = {
  region: 3,      // 지역 일치 (낮춤)
  alcohol: 4,     // 주종 일치
  vibe: 3,        // 분위기 일치
  purpose: 2,     // 상황 일치
  food: 2,        // 음식 일치
  curator_save: 1, // 큐레이터 저장 수 (낮춤)
  multi_curator: 2, // 여러 큐레이터 겹침 (낮춤)
  tag_match: 1,   // 태그 일치
  name_match: 2,  // 이름 부분 일치 (추가)
  random_factor: 1 // 랜덤 요소 (추가)
};

// 자연어 파싱 함수
export function parseNaturalQuery(query) {
  console.log('🔍 parseNaturalQuery 입력:', query);
  
  const result = {
    region: null,
    alcohol: null,
    vibe: null,
    purpose: null,
    food: null,
    tags: [],
    confidence: 0
  };

  const lowerQuery = query.toLowerCase();
  console.log('🔍 소문자 변환:', lowerQuery);
  
  let matches = 0;

  // 지역 파싱
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        result.region = region;
        result.tags.push(region);
        matches++;
        break;
      }
    }
  }

  // 주종 파싱
  for (const [alcohol, keywords] of Object.entries(ALCOHOL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        result.alcohol = alcohol;
        result.tags.push(alcohol);
        matches++;
        break;
      }
    }
  }

  // 분위기 파싱
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        result.vibe = vibe;
        result.tags.push(vibe);
        matches++;
        break;
      }
    }
  }

  // 상황 파싱
  for (const [purpose, keywords] of Object.entries(PURPOSE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        result.purpose = purpose;
        result.tags.push(purpose);
        matches++;
        break;
      }
    }
  }

  // 음식 파싱
  for (const [food, keywords] of Object.entries(FOOD_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        result.food = food;
        result.tags.push(food);
        matches++;
        break;
      }
    }
  }

  // 신뢰도 계산 (찾은 키워드 수 / 전체 카테고리 수)
  result.confidence = matches / 5; // 5개 카테고리 기준

  return result;
}

// 장소 점수 계산 함수 - 더 다양한 결과를 위해 개선
export function scorePlace(place, parsedQuery) {
  let score = 0;
  const reasons = [];
  
  // 기본 점수 (모든 장소에게 기회 부여)
  score += 1;
  reasons.push('기본 후보');

  // 지역 일치
  if (parsedQuery.region && place.address && place.address.includes(parsedQuery.region)) {
    score += WEIGHTS.region;
    reasons.push(`${parsedQuery.region} 지역`);
  }

  // 주종 일치 (카테고리나 이름으로 확인)
  if (parsedQuery.alcohol) {
    if (place.category_name?.includes(parsedQuery.alcohol) || 
        place.name?.includes(parsedQuery.alcohol)) {
      score += WEIGHTS.alcohol;
      reasons.push(`${parsedQuery.alcohol} 관련`);
    }
  }

  // 분위기 일치 (태그나 카테고리로 확인)
  if (parsedQuery.vibe) {
    if (place.tags?.includes(parsedQuery.vibe) || 
        place.category_name?.includes(parsedQuery.vibe)) {
      score += WEIGHTS.vibe;
      reasons.push(`${parsedQuery.vibe} 분위기`);
    }
  }

  // 상황 일치
  if (parsedQuery.purpose) {
    if (place.tags?.includes(parsedQuery.purpose) || 
        place.category_name?.includes(parsedQuery.purpose)) {
      score += WEIGHTS.purpose;
      reasons.push(`${parsedQuery.purpose}에 적합`);
    }
  }

  // 음식 일치
  if (parsedQuery.food) {
    if (place.tags?.includes(parsedQuery.food) || 
        place.category_name?.includes(parsedQuery.food)) {
      score += WEIGHTS.food;
      reasons.push(`${parsedQuery.food} 메뉴`);
    }
  }

  // 이름 부분 일치 (더 유연한 매칭)
  if (parsedQuery.alcohol && place.name?.toLowerCase().includes(parsedQuery.alcohol.toLowerCase())) {
    score += WEIGHTS.name_match;
    reasons.push('이름 부분 일치');
  }

  // 태그 일치 (일반적인 매칭)
  if (parsedQuery.tags && place.tags) {
    const tagMatches = parsedQuery.tags.filter(tag => place.tags.includes(tag));
    if (tagMatches.length > 0) {
      score += WEIGHTS.tag_match * tagMatches.length;
      reasons.push(`태그 일치: ${tagMatches.join(', ')}`);
    }
  }

  // 큐레이터 저장 수 보너스 (영향력 줄임)
  if (place.curator_count > 0) {
    score += WEIGHTS.curator_save;
    reasons.push('큐레이터 추천');
  }

  // 여러 큐레이터 겹침 보너스 (영향력 줄임)
  if (place.curator_count > 1) {
    score += WEIGHTS.multi_curator;
    reasons.push('인기 장소');
  }

  // 랜덤 요소 추가 (다양성 확보)
  score += Math.random() * WEIGHTS.random_factor;
  reasons.push('랜덤 요소');

  return {
    score,
    reasons,
    match_reasons: reasons
  };
}

// 검색 결과 없을 때 대안 검색 제안
export function generateAlternativeSuggestions(parsedQuery, availablePlaces) {
  const suggestions = [];

  // 지역 기반 대안
  if (parsedQuery.region && availablePlaces.length > 0) {
    const regionPlaces = availablePlaces.filter(p => 
      p.address?.includes(parsedQuery.region)
    );
    if (regionPlaces.length > 0) {
      suggestions.push({
        type: 'region_expansion',
        message: `${parsedQuery.region}의 술집으로 볼까요?`,
        places: regionPlaces.slice(0, 5)
      });
    }
  }

  // 주종 기반 대안
  if (parsedQuery.alcohol) {
    const alcoholPlaces = availablePlaces.filter(p => 
      p.category_name?.includes(parsedQuery.alcohol) || 
      p.name?.includes(parsedQuery.alcohol)
    );
    if (alcoholPlaces.length > 0) {
      suggestions.push({
        type: 'alcohol_expansion',
        message: `${parsedQuery.alcohol} 관련 장소를 볼까요?`,
        places: alcoholPlaces.slice(0, 5)
      });
    }
  }

  // 분위기 기반 대안
  if (parsedQuery.vibe) {
    const vibePlaces = availablePlaces.filter(p => 
      p.tags?.includes(parsedQuery.vibe)
    );
    if (vibePlaces.length > 0) {
      suggestions.push({
        type: 'vibe_expansion',
        message: `${parsedQuery.vibe} 분위기 장소를 볼까요?`,
        places: vibePlaces.slice(0, 5)
      });
    }
  }

  return suggestions;
}

// 검색 예시 목록
export const SEARCH_EXAMPLES = [
  "성수 2차 하이볼",
  "을지로 조용한 소주집",
  "강남 데이트 와인",
  "해산물에 술 좋은 곳",
  "홍대 시끌벅적 맥주",
  "혼술하기 좋은 막걸리",
  "부산 회식 장소",
  "전통적인 사케바"
];

// 인기 태그 목록
export const POPULAR_TAGS = [
  '#소주', '#하이볼', '#조용한', '#2차', '#데이트', 
  '#을지로', '#성수', '#강남', '#와인', '#맥주', 
  '#혼술', '#회식', '#친구', '#해산물', '#홍대'
];
