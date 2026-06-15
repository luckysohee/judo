const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bytesToUuidV4(bytes) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function fillRandomBytes(bytes) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
    return;
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
}

/**
 * 검색 세션·Realtime 토픽 등 — `crypto.randomUUID` 미지원 환경(WebView·비보안 컨텍스트) 폴백.
 * Supabase `uuid` 컬럼과 호환되는 v4 형식만 반환.
 */
export function createRandomUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  fillRandomBytes(bytes);
  return bytesToUuidV4(bytes);
}

/** @param {string} value */
export function isUuidV4String(value) {
  return UUID_V4_RE.test(String(value || "").trim());
}
