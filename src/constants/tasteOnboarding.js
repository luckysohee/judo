/**
 * 취향 온보딩에서 고를 수 있는 태그(표시 순서 고정).
 * 컬렉션 `tags` 와 맞물리도록 실제 서비스 태그 문자열과 동일하게 둔다.
 */
export const TASTE_ONBOARDING_OPTIONS = [
  "데이트",
  "야장",
  "노포",
  "혼술",
  "소개팅",
  "새벽",
  "가성비",
  "분위기",
];

/** @type {ReadonlySet<string>} */
export const TASTE_ONBOARDING_OPTION_SET = new Set(TASTE_ONBOARDING_OPTIONS);
