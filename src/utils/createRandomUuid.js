/**
 * 검색 세션·Realtime 토픽 등 — `crypto.randomUUID` 미지원 환경(WebView·비보안 컨텍스트) 폴백.
 */
export function createRandomUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
