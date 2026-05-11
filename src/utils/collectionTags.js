/**
 * 컬렉션 상황 태그 정규화 + preset.
 *
 * - DB(`collections.tags text[]`)는 단순 배열로만 유지하고, 입력 정규화·중복 제거·
 *   길이/개수 제한은 모두 클라이언트에서 처리한다.
 * - preset 은 빠른 토글용 추천 목록이며 자유입력도 함께 허용한다.
 * - 비교는 lowercased trim 으로 하되 표시는 입력 원형을 유지한다.
 */

export const COLLECTION_TAG_PRESETS = Object.freeze([
  "데이트",
  "소개팅",
  "야장",
  "노포",
  "혼술",
  "새벽",
  "모임",
  "기념일",
  "가성비",
  "분위기",
]);

export const COLLECTION_TAG_MAX_LEN = 20;
export const COLLECTION_TAG_MAX_COUNT = 12;

/**
 * 한 태그를 정규화. 빈 문자열·길이 초과면 `null`.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeCollectionTag(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length === 0) return null;
  if (t.length > COLLECTION_TAG_MAX_LEN) return null;
  return t;
}

/**
 * 입력 배열을 정규화 + 대소문자 무시 dedup + 최대 개수 캡.
 *
 * @param {unknown} input — 배열·문자열·null 모두 허용
 * @returns {string[]}
 */
export function dedupeAndNormalizeCollectionTags(input) {
  let arr = [];
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === "string") {
    arr = splitCollectionTagsInput(input);
  }
  const seenLower = new Set();
  const out = [];
  for (const v of arr) {
    const norm = normalizeCollectionTag(v);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seenLower.has(key)) continue;
    seenLower.add(key);
    out.push(norm);
    if (out.length >= COLLECTION_TAG_MAX_COUNT) break;
  }
  return out;
}

/**
 * 자유입력 텍스트를 콤마/공백/줄바꿈/`#` 기준으로 토큰화.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitCollectionTagsInput(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/[,\n\r#]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 두 태그가 같은 태그인지(case-insensitive trim) 비교.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isSameCollectionTag(a, b) {
  const na = normalizeCollectionTag(a);
  const nb = normalizeCollectionTag(b);
  if (!na || !nb) return false;
  return na.toLowerCase() === nb.toLowerCase();
}

/**
 * `value` 가 preset 태그면 그 인덱스, 아니면 `-1`.
 *
 * @param {string} value
 * @returns {number}
 */
export function presetIndex(value) {
  const norm = normalizeCollectionTag(value);
  if (!norm) return -1;
  const lower = norm.toLowerCase();
  for (let i = 0; i < COLLECTION_TAG_PRESETS.length; i += 1) {
    if (COLLECTION_TAG_PRESETS[i].toLowerCase() === lower) return i;
  }
  return -1;
}
