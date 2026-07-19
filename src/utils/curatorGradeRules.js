/**
 * 등급 기여 수 → 등급
 * 기여 = 추천 장소 1점 + 직접 만든 코스 × 가중치(기본 3)
 * DB `grade_from_place_count` / 트리거와 동일 구간.
 * (`curators.total_places` 컬럼명 유지 — 값은 가중 합산)
 */
export const GRADE_ORDER = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
};

export const GRADE_LABELS_KO = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  platinum: "플래티넘",
  diamond: "다이아몬드",
};

/** @param {number} contributionCount 가중 기여 합 */
export function gradeFromPlaceCount(contributionCount) {
  const n = Number(contributionCount);
  if (!Number.isFinite(n) || n < 0) return "bronze";
  if (n >= 1000) return "diamond";
  if (n >= 500) return "platinum";
  if (n >= 200) return "gold";
  if (n >= 100) return "silver";
  return "bronze";
}

/** @deprecated 이름 호환 — {@link gradeFromPlaceCount} 와 동일 */
export const gradeFromContributionCount = gradeFromPlaceCount;

export function gradeRank(grade) {
  const g = String(grade || "bronze").toLowerCase();
  return GRADE_ORDER[g] ?? 0;
}

/** 추천 등급이 저장된 등급보다 높은지 (승급 검토 필요) */
export function needsGradePromotion(currentGrade, contributionCount) {
  const cur = String(currentGrade || "bronze").toLowerCase();
  const sug = gradeFromPlaceCount(contributionCount);
  return gradeRank(sug) > gradeRank(cur);
}
