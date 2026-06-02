/** 세션 내 카카오 장소 상세·썸네일 — 동일 id 재요청 방지 */
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX = 400;
const store = new Map();

function cacheKey(placeId, opts = {}) {
  const q = String(opts.query || "").trim().slice(0, 80);
  const x =
    opts.x != null && Number.isFinite(Number(opts.x))
      ? Number(opts.x).toFixed(4)
      : "";
  const y =
    opts.y != null && Number.isFinite(Number(opts.y))
      ? Number(opts.y).toFixed(4)
      : "";
  return `${String(placeId).trim()}|${q}|${x},${y}`;
}

export function readKakaoPlaceDetailCache(placeId, opts = {}) {
  const key = cacheKey(placeId, opts);
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.exp) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

export function writeKakaoPlaceDetailCache(placeId, opts = {}, value) {
  const key = cacheKey(placeId, opts);
  if (store.size >= MAX) {
    const first = store.keys().next().value;
    if (first != null) store.delete(first);
  }
  store.set(key, { value, exp: Date.now() + TTL_MS });
}
