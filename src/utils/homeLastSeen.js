/**
 * 홈 리텐션 카드용 lightweight `last_seen_at` 저장소.
 *
 * - 서버 컬럼이 따로 없으므로 `localStorage` 에 ISO timestamp 만 저장.
 * - 비로그인 / 신규 디바이스 / 시크릿 모드 등 값이 없을 때는 fallback 으로
 *   `Date.now() - DEFAULT_FALLBACK_DAYS * 24h` 를 사용한다(혼자 너무 멀어 보이지 않게).
 * - 검색·지도·`useCourseSearch` 와 무관하게 단독으로 동작.
 */

const STORAGE_KEY_BASE = "judo_home_last_seen_v1";
const ANON_SUFFIX = "anon";
const DEFAULT_FALLBACK_DAYS = 3;

/** 너무 옛날을 반환하지 않도록 캡 — 30일 이전이면 30일로 자른다. */
const MAX_LOOKBACK_DAYS = 30;

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} userId
 * @returns {string}
 */
function storageKeyFor(userId) {
  const k = String(userId ?? "").trim() || ANON_SUFFIX;
  return `${STORAGE_KEY_BASE}.${k}`;
}

/**
 * 마지막 방문 ISO timestamp 를 반환. 저장값이 없거나 파싱 실패 시
 * 기본 fallback 값(약 3일 전)을 반환한다.
 *
 * @param {string | null | undefined} userId
 * @returns {{ iso: string, ms: number, isFallback: boolean }}
 */
export function readHomeLastSeen(userId) {
  const fallbackMs =
    Date.now() - DEFAULT_FALLBACK_DAYS * 24 * 60 * 60 * 1000;
  const storage = safeStorage();
  if (!storage) {
    return {
      iso: new Date(fallbackMs).toISOString(),
      ms: fallbackMs,
      isFallback: true,
    };
  }
  const raw = storage.getItem(storageKeyFor(userId));
  if (!raw) {
    return {
      iso: new Date(fallbackMs).toISOString(),
      ms: fallbackMs,
      isFallback: true,
    };
  }
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) {
    return {
      iso: new Date(fallbackMs).toISOString(),
      ms: fallbackMs,
      isFallback: true,
    };
  }
  const minMs = Date.now() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const clamped = t < minMs ? minMs : t;
  return {
    iso: new Date(clamped).toISOString(),
    ms: clamped,
    isFallback: false,
  };
}

/**
 * 현재 시각을 last_seen 으로 마킹.
 * 호출 측은 ① revisit 카드를 본 직후 또는 ② 카드를 닫았을 때 호출한다.
 *
 * @param {string | null | undefined} userId
 */
export function writeHomeLastSeenNow(userId) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKeyFor(userId), new Date().toISOString());
  } catch {
    /* QuotaExceeded 등 무시 */
  }
}
