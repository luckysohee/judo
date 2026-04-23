/**
 * 검색 종류(`detectHomeSearchExecutionKind`) 경계·오분류 후보 픽스처.
 * - `expectedKind`가 있으면 테스트에서 단언.
 * - `expectedKind: null`이면 운영 관찰용(현재 구현과 무관하게 목록만 유지).
 */

export const SEARCH_KIND_EDGE_FIXTURES = [
  // keyword로 가야 할지 애매한 케이스
  {
    id: "seongsu-date",
    query: "성수 데이트",
    bucket: "keyword_tension",
    note: "짧은 지역+상황 명사 — 제품 정책에 따라 keyword/ai 조정 가능",
    expectedKind: null,
  },
  {
    id: "euljiro-2cha",
    query: "을지로 2차",
    bucket: "keyword_tension",
    expectedKind: "keyword_search",
  },
  {
    id: "hannam-wine",
    query: "한남 와인",
    bucket: "keyword_tension",
    expectedKind: "keyword_search",
  },
  {
    id: "gangnam-sogaeting",
    query: "강남 소개팅",
    bucket: "keyword_tension",
    expectedKind: "keyword_search",
  },
  {
    id: "apgujeong-quiet",
    query: "압구정 조용한곳",
    bucket: "keyword_tension",
    note: "조용한 포함 시 NL 쪽으로 기울 수 있음",
    expectedKind: null,
  },

  // ai로 가야 할지 애매한 케이스
  {
    id: "mood-good-place",
    query: "분위기 좋은 곳",
    bucket: "ai_tension",
    expectedKind: "ai_parse_search",
  },
  {
    id: "talk-bar",
    query: "얘기하기 좋은 바",
    bucket: "ai_tension",
    expectedKind: "ai_parse_search",
  },
  {
    id: "today-light-drink",
    query: "오늘 가볍게 한잔",
    bucket: "ai_tension",
    expectedKind: "ai_parse_search",
  },
  {
    id: "after-sogaeting",
    query: "소개팅 끝나고 갈만한 곳",
    bucket: "ai_tension",
    expectedKind: "ai_parse_search",
  },
];
