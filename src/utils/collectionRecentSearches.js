/**
 * 컬렉션 검색 페이지 — 최근 검색어 lightweight storage.
 *
 * - localStorage 만 사용. SSR/sandbox 처럼 storage 접근이 막혀 있어도 throw 하지 않고
 *   조용히 빈 배열을 반환한다.
 * - 정규화 비교는 lowercased trim 기준으로 하되 화면 표시용 원형(trim)은 그대로 보존한다.
 * - 한 항목 길이 32자 cap, 전체 6개 cap.
 */

const STORAGE_KEY = "judo:collectionRecentSearches:v1";
const MAX_ITEMS = 6;
const MAX_LEN = 32;

function safeStorage() {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    if (!s) return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * 한 항목을 정규화. 빈 문자열·길이 초과면 `null`.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalize(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length === 0) return null;
  if (t.length > MAX_LEN) return null;
  return t;
}

/**
 * 저장된 최근 검색어 목록(최신순).
 *
 * @returns {string[]}
 */
export function readRecentCollectionSearches() {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const out = [];
    for (const v of parsed) {
      const norm = normalize(v);
      if (!norm) continue;
      const key = norm.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(norm);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * 새 검색어를 맨 앞에 추가. 동일(case-insensitive) 항목은 합쳐서 위로 끌어올린다.
 *
 * @param {string} query
 * @returns {string[]} — 갱신 후 목록
 */
export function pushRecentCollectionSearch(query) {
  const norm = normalize(query);
  if (!norm) return readRecentCollectionSearches();
  const storage = safeStorage();
  const current = readRecentCollectionSearches();
  const lower = norm.toLowerCase();
  const filtered = current.filter((v) => v.toLowerCase() !== lower);
  const next = [norm, ...filtered].slice(0, MAX_ITEMS);
  if (!storage) return next;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / disabled — 무시 */
  }
  return next;
}

/**
 * 단일 항목 삭제.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function removeRecentCollectionSearch(query) {
  const norm = normalize(query);
  const current = readRecentCollectionSearches();
  if (!norm) return current;
  const lower = norm.toLowerCase();
  const next = current.filter((v) => v.toLowerCase() !== lower);
  const storage = safeStorage();
  if (!storage) return next;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / disabled — 무시 */
  }
  return next;
}

/**
 * 전체 삭제.
 *
 * @returns {string[]}
 */
export function clearRecentCollectionSearches() {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
  return [];
}

export const COLLECTION_RECENT_SEARCH_LIMIT = MAX_ITEMS;
