/**
 * 등록 장소 수 → 등급 (DB `update_curator_grade` / 트리거와 동일 구간)
 * UI 문구·추천 배너에서 공통 사용
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

export function gradeFromPlaceCount(totalPlaces) {
  const n = Number(totalPlaces);
  if (!Number.isFinite(n) || n < 0) return "bronze";
  if (n >= 1000) return "diamond";
  if (n >= 500) return "platinum";
  if (n >= 200) return "gold";
  if (n >= 100) return "silver";
  return "bronze";
}

export function gradeRank(grade) {
  const g = String(grade || "bronze").toLowerCase();
  return GRADE_ORDER[g] ?? 0;
}

/** 추천 등급이 저장된 등급보다 높은지 (승급 검토 필요) */
export function needsGradePromotion(currentGrade, totalPlaces) {
  const cur = String(currentGrade || "bronze").toLowerCase();
  const sug = gradeFromPlaceCount(totalPlaces);
  return gradeRank(sug) > gradeRank(cur);
}
