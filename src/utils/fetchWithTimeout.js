/**
 * AbortController 기반 타임아웃 fetch.
 * Supabase·서버가 느리거나 응답이 없을 때 무한 대기(지도 '불러오는 중…' 멈춤)를 막는다.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs] 기본 8000ms
 * @returns {Promise<Response>}
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
) {
  const ms = Number.isFinite(Number(timeoutMs))
    ? Math.max(1, Number(timeoutMs))
    : DEFAULT_FETCH_TIMEOUT_MS;

  if (typeof AbortController === "undefined") {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      const err = new Error(`요청 시간이 초과됐어요 (${Math.round(ms / 1000)}초)`);
      err.code = "ETIMEDOUT";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
