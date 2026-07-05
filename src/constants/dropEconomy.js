/** Drop → AI Credit 교환 비율 (UI·RPC 공통) */
export const DROPS_PER_AI_CREDIT = 15;

/**
 * Drop·AI Credit 프로필/토스트 UI.
 * false: 일반 유저 소비처 미정(코스 만들기는 큐레이터 전용) — DB·RPC만 유지.
 */
export const USER_DROP_WALLET_UI_ENABLED = false;

/** UI 표기 */
export const DROP_UNIT_LABEL = "Drop";
export const AI_CREDIT_UNIT_LABEL = "AI Credit";

/** ledger reason keys (서버와 동일하게 유지) */
export const DROP_AWARD_REASONS = {
  check_in: "check_in",
  save_place: "save_place",
  light_review: "light_review",
  exchange_refund: "exchange_refund",
  admin_grant: "admin_grant",
};

export const AI_CREDIT_SPEND_REASONS = {
  /** 홈 AI 기능(맞춤 검색 등) — 코스 초안/만들기(Studio)와 별도 */
  home_ai_feature: "home_ai_feature",
  /** @deprecated rename → home_ai_feature */
  home_ai_course: "home_ai_course",
  admin_grant: "admin_grant",
};
