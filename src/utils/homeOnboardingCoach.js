/** 홈 첫 진입 코치마크 — 알바·일반 배포 공통, 1회 노출 */
export const HOME_ONBOARDING_STORAGE_KEY = "judo_home_onboarding_v1";

/**
 * @typedef {Object} HomeOnboardingStep
 * @property {string} target `data-judo-coach` 값
 * @property {string} title
 * @property {string} body
 * @property {'above' | 'below'} placement 툴팁 위치
 */

/** @type {HomeOnboardingStep[]} */
export const HOME_ONBOARDING_STEPS = [
  {
    target: "search-bar",
    title: "하단 검색",
    body: "검색어를 입력하면 장소·분위기·상황에 맞는 코스를 찾을 수 있어요.",
    placement: "above",
  },
  {
    target: "curator-filter",
    title: "큐레이터",
    body: "취향에 맞는 큐레이터 픽 장소만 필터해서 볼 수 있어요.",
    placement: "below",
  },
  {
    target: "course-chip",
    title: "코스",
    body: "큐레이터가 만든 추천 코스를 검색하고 저장할 수 있어요.",
    placement: "below",
  },
  {
    target: "quick-chips",
    title: "바로가기 칩",
    body: "칩을 눌러 분위기·상황별 검색을 간편하게 실행할 수 있어요.",
    placement: "above",
  },
];

export function isHomeOnboardingCompleted() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(HOME_ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHomeOnboardingCompleted() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HOME_ONBOARDING_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetHomeOnboardingForDev() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HOME_ONBOARDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
