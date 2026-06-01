/**
 * VITE_AI_API_BASE_URL 정규화.
 * `judo-production.up.railway.app` 처럼 scheme 없이 넣으면
 * 브라우저가 `https://현재호스트/judo-production...` 로 요청하는 버그 방지.
 */
export function normalizeApiBaseUrl(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  return `https://${s.replace(/^\/+/, "")}`;
}

/** @returns {string} Railway 등 API origin (끝 슬래시 없음). 비우면 "" → 상대 `/api` */
export function getAiApiBaseUrl() {
  return normalizeApiBaseUrl(import.meta.env.VITE_AI_API_BASE_URL);
}
