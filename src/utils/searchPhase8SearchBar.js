/**
 * 8단계: 주도 검색바의 현실적인 최종 형태
 *
 * **챗봇이 아닌 똑똑한 지도 검색창**이 주도 UX다.
 * 핵심은 대화형 AI가 아니라, 큐레이터와 장소를 연결해 발견을 돕는 것.
 *
 * ### 검색바 구조 (목표)
 *
 * **입력**
 * - 자연어 1줄
 *
 * **내부 처리**
 * - `parseNaturalQuery()` — 의도·태그·필터로 정규화
 * - 태그 추출
 * - 지역 / 주종 / 분위기 / 상황 분리
 * - `scorePlaces()` — 후보 장소에 점수·이유 부여 (지도/API 후보 위에서만)
 *
 * **출력**
 * - 추천 장소
 * - 추천 큐레이터
 * - 추천 태그
 * - 검색 확장 제안
 *
 * ### 현재 코드베이스 매핑 (리네이밍 없이 연결만)
 *
 * | 목표 | 실제 |
 * |------|------|
 * | parseNaturalQuery | `parseNaturalQuery.js` → 내부에서 `parseSearchQuery`만 사용 (사전 단일화) |
 * | 태그·칩 | `createFilterChips`, `createSearchSummary` |
 * | scorePlaces | `calculateLocalAIScores` (`Home.jsx`), `scorePlace` (`searchParser.js`) |
 * | 추천 장소 | 카카오 검색 + 스코어 후 `kakaoPlaces` / `externalPlaces` |
 * | 추천 큐레이터 | 큐레이터 필터·DB 추천 플로우 (검색바와 병행, 단계적 강화) |
 * | 추천 태그 | 파싱 결과 칩 + (데이터 쌓이면 `searchPhase7Guidance` 집계) |
 * | 검색 확장 제안 | `buildExpansionSuggestions` + 의도 보조 API |
 */

/** 문서용 파이프라인 요약 (런타임 로직 없음) */
// 실행 우선순위(바로/나중): `searchPhase9Priorities.js`

export const SEARCH_BAR_CONTRACT = {
  input: ["natural_language_single_line"],
  internal: [
    "parseNaturalQuery",
    "extract_tags",
    "split_region_alcohol_vibe_situation",
    "scorePlaces",
  ],
  output: [
    "recommended_places",
    "recommended_curators",
    "recommended_tags",
    "search_expansion_suggestions",
  ],
};
