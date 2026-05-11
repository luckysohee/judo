const EXP_PREFIX = "judo_exp:";

function safeGetLocalStorage(key) {
  try {
    return window?.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function pickRandomIndex(n) {
  const cap = Math.max(1, Math.floor(Number(n) || 1));
  try {
    const a = new Uint32Array(1);
    window?.crypto?.getRandomValues?.(a);
    return Number(a[0] % cap);
  } catch {
    return Math.floor(Math.random() * cap);
  }
}

/**
 * localStorage 기반 experiment bucket.
 * - 최초 1회 랜덤으로 결정 후 localStorage에 저장
 * - 이후 유지
 *
 * @param {string} experimentKey
 * @param {string[]} buckets
 * @param {string} [fallback]
 * @returns {string}
 */
export function getOrAssignExperimentBucket(
  experimentKey,
  buckets,
  fallback = "",
) {
  const key = String(experimentKey || "").trim();
  const list = Array.isArray(buckets)
    ? buckets.map((b) => String(b || "").trim()).filter(Boolean)
    : [];
  const fb = String(fallback || "").trim() || (list[0] || "");

  if (typeof window === "undefined") return fb;
  if (!key || list.length === 0) return fb;

  const storageKey = `${EXP_PREFIX}${key}`;
  const existing = safeGetLocalStorage(storageKey);
  if (existing && list.includes(existing)) return existing;

  const idx = pickRandomIndex(list.length);
  const chosen = list[idx] || fb;
  if (chosen) safeSetLocalStorage(storageKey, chosen);
  return chosen || fb;
}

/**
 * Home layout 실험 (minimal): v1(activity-first) vs v2(situation-first)
 */
export const HOME_LAYOUT_EXPERIMENT_NAME = "home_layout";
export const HOME_LAYOUT_EXPERIMENT_VERSION = "1";
export const HOME_LAYOUT_EXPERIMENT_KEY = `${HOME_LAYOUT_EXPERIMENT_NAME}_v${HOME_LAYOUT_EXPERIMENT_VERSION}`;
export const HOME_LAYOUT_BUCKET = {
  V1: "home_layout_v1",
  V2: "home_layout_v2",
};
export const HOME_LAYOUT_BUCKETS = [
  HOME_LAYOUT_BUCKET.V1,
  HOME_LAYOUT_BUCKET.V2,
];

