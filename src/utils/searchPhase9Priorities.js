/**
 * 9단계: 지금 당장 우선순위 (로드맵)
 *
 * 아래는 “너라면 이렇게” 정렬한 실행 순서. 구현 상태는 주석으로 갱신한다.
 */

/** 바로 해야 할 것 */
export const DO_NOW = [
  {
    id: "parse-rules-table",
    title: "검색어 파싱 규칙표",
    detail:
      "지역/주종/분위기/상황 키워드 매핑을 한곳에서 보이게 정리 (표·주석·스프레드시트 동기화).",
    code: ["src/utils/searchParser.js (REGION_KEYWORDS 등)"],
    status: "진행 중 — 사전은 코드에 있음, 별도 규칙표 문서는 미정",
  },
  {
    id: "tag-dictionary",
    title: "태그 사전 정리",
    detail: "동의어·오타·구어체를 사전에 흡수해 파싱 안정화.",
    code: ["src/utils/searchDictionary.js (SEARCH_DICTIONARY)", "src/utils/searchParser.js (병합 로직)"],
    status: "진행 중 — 사전·파서 병합됨, 동의어 확장·DB화는 여전히 열림",
  },
  {
    id: "weighted-scoring",
    title: "가중치 기반 점수 로직",
    detail: "후보는 지도/API만; 점수·이유는 명시적 가중치로 조정 가능하게.",
    code: [
      "src/pages/Home/Home.jsx (calculateLocalAIScores)",
      "src/utils/searchParser.js (scorePlace)",
    ],
    status: "부분 구현 — 가중치를 상수·설정으로 빼는 작업 권장",
  },
  {
    id: "empty-alternatives",
    title: "결과 없음 시 대안 검색",
    detail: "확장 쿼리·자동 재시도·한 번에 넓게 버튼.",
    code: [
      "src/utils/searchExpansionSuggestions.js",
      "src/pages/Home/Home.jsx (searchExpandUX, intent assist)",
    ],
    status: "구현됨",
  },
  {
    id: "search-logs",
    title: "검색 로그 저장",
    detail: "검색 1회 1행 + 세션·북마크 연동.",
    code: [
      "src/utils/searchAnalytics.js",
      "database/create_search_logs_tables.sql",
    ],
    status: "구현됨 (Supabase 스키마·RLS 운영 확인은 별도)",
  },
];

/** 나중에 할 것 */
export const DO_LATER = [
  {
    id: "llm-parse-boost",
    title: "LLM으로 자연어 파싱 보강",
    detail: "룰 파서 보조만; 장소 발명 금지. `searchPhase8SearchBar.js` 계약 준수.",
    code: ["server /api/search-intent-assist", "src/utils/searchAIAssistant.js"],
  },
  {
    id: "click-save-reco",
    title: "클릭/저장 로그 기반 추천",
    detail: "place_click_logs·search_logs 집계, 룰/협업 필터부터.",
    code: ["src/utils/searchAnalytics.js", "database/03_search_patterns.sql"],
    seeAlso: "src/utils/searchPhase7Guidance.js",
  },
  {
    id: "personalization",
    title: "개인화 추천",
    detail: "로그·선호 쌓인 뒤.",
    code: [],
  },
  {
    id: "ml-ranking",
    title: "ML 랭킹 모델",
    detail: "`searchPhase7Guidance.js` ML_READINESS 체크 후.",
    code: ["src/utils/searchPhase7Guidance.js"],
  },
];
