/**
 * 클로즈드 알파 — Vercel 프로덕션에서만 `VITE_ALPHA_ALLOWLIST_ENABLED=true` 권장.
 * 로컬 개발은 기본 off (명시적으로 true 로 켜면 테스트 가능).
 */
export function isAlphaAllowlistEnabled() {
  return String(import.meta.env.VITE_ALPHA_ALLOWLIST_ENABLED || "").trim() === "true";
}

/** 약관·개인정보처리방침 등 비로그인에서도 열어 둘 경로 */
export const ALPHA_GATE_PUBLIC_PATHS = ["/terms", "/privacy"];
