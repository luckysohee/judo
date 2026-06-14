export const MAP_VIEWPORT_SESSION_CACHE_KEY = "judo_map_viewport_places_v1";
export const MAP_VIEWPORT_SESSION_CACHE_TTL_MS = 12 * 60 * 1000;

/** @returns {{ ts: number, cacheKey?: string, plainRows?: object[], joinRows?: object[], merged: object[] } | null} */
export function readHomeMapViewportSessionCache() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MAP_VIEWPORT_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const age = Date.now() - Number(parsed?.ts || 0);
    if (age < 0 || age >= MAP_VIEWPORT_SESSION_CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed?.merged) || parsed.merged.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 성수 첫 진입용 — cacheKey가 현재 부트 뷰포트와 일치할 때만 즉시 마커 복원.
 * @param {string | null | undefined} bootCacheKey
 */
export function readHomeMapViewportSessionCacheForBoot(bootCacheKey) {
  const parsed = readHomeMapViewportSessionCache();
  if (!parsed) return null;
  if (bootCacheKey && parsed.cacheKey !== bootCacheKey) return null;
  return parsed;
}

/** @param {{ cacheKey?: string, plainRows?: object[], joinRows?: object[], merged: object[] }} payload */
export function writeHomeMapViewportSessionCache(payload) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      MAP_VIEWPORT_SESSION_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        ...payload,
      }),
    );
  } catch {
    /* ignore quota */
  }
}
