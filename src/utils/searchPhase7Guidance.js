/**
 * 7단계: ML은 언제 시작하나
 *
 * 진짜 ML(랭킹 학습, 임베딩 검색 등)은 아래가 어느 정도 쌓인 뒤에만 검토한다.
 * 그 전에는 ML을 붙이지 않고, 검색 품질·메타데이터 구조화·룰/집계에 집중한다.
 */

/** 데이터·운영 쪽에서 “ML 착수 검토” 전에 채워야 할 최소 조건(체크리스트) */
export const ML_READINESS_CHECKLIST = [
  "search_logs: 검색 로그 볼륨·기간 (의미 있는 분포)",
  "place_click_logs: 장소별 클릭률·전환 퍼널",
  "저장 전환: 검색 세션 → 저장률 (search_logs.bookmarked 등)",
  "큐레이터 중복 저장·공동 언급 데이터 (같은 장소를 여러 큐레이터가 저장)",
  "태그 정규화 사전·동의어 테이블",
  "지역 / 주종 / 분위기 메타데이터 일관 스키마 (파싱·DB·로그 정합)",
];

/**
 * ML 전에 할 일 (룰·집계로 충분한 영역)
 *
 * 1) 연관 태그 추천 — “하이볼” 검색/클릭이 많은 사용자가 “2차”, “가벼운 안주”, “바”도
 *    자주 쓰는 패턴을 co-occurrence 집계로 제안 (SQL/배치, 모델 불필요).
 * 2) 인기 조합 집계 — 성수+하이볼, 을지로+소주+노포 등 search_logs 파싱 필드 GROUP BY.
 * 3) 큐레이터 기반 — “이 큐레이터 저장 장소를 좋아한 사람은 이런 곳도” =
 *    저장 폴더·큐레이터 공동 저장 룰 기반 후보 (협업 필터는 나중).
 */

/** @returns {boolean} 데이터가 부족하면 항상 false. 나중에 임계값·플래그로 확장 */
export function shouldStartMLEmbeddingsOrRanking() {
  return false;
}

/** 시드 태그(한 단어 수준)에 대한 룰 기반 연관 태그 — 집계 테이블 붙이기 전 UX/개발용 */
const RELATED_TAGS_RULES = {
  하이볼: ["2차", "가벼운 안주", "바", "펍"],
  소주: ["회식", "안주", "노포", "포차"],
  와인: ["데이트", "와인바", "조용한"],
  사케: ["이자카야", "일식", "2차"],
  맥주: ["크래프트", "호프", "펍"],
  "2차": ["하이볼", "가벼운 안주", "포차"],
  데이트: ["와인", "조용한", "바"],
};

/**
 * @param {string} seedTag
 * @returns {string[]}
 */
export function relatedTagsRuleBased(seedTag) {
  const k = String(seedTag || "")
    .trim()
    .toLowerCase();
  if (!k) return [];
  const entry = Object.entries(RELATED_TAGS_RULES).find(
    ([key]) => key.toLowerCase() === k
  );
  return entry ? [...entry[1]] : [];
}

/**
 * 인기 조합 예시 (집계 API 연동 전 카피·UI 시드). 실서비스는 search_logs 기반 쿼리로 대체.
 * @returns {{ label: string, queryHint: string }[]}
 */
export function popularCombosDemo() {
  return [
    { label: "성수 + 하이볼", queryHint: "성수 하이볼" },
    { label: "을지로 + 소주 + 노포", queryHint: "을지로 소주" },
    { label: "강남 + 와인 + 데이트", queryHint: "강남 와인 데이트" },
  ];
}

/**
 * 향후: Supabase에서 search_logs 파싱 컬럼으로 GROUP BY 한 인기 조합.
 * @returns {Promise<null | { region: string, alcohol: string, vibe: string | null, count: number }[]>}
 */
export async function fetchPopularParsedCombosFromLogs() {
  // 구현 시: supabase.rpc('search_log_combo_counts') 또는 읽기 전용 뷰
  return null;
}

/**
 * 향후: 큐레이터 A 저장 장소을 좋아한 사용자가 많이 본/저장한 다른 장소 (룰·집계).
 * @returns {Promise<null | string[]>}
 */
export async function fetchCuratorAffinityPlaceIds() {
  return null;
}
