import { SEARCH_DICTIONARY } from "./searchDictionary.js";

/** 동의어 → 공식 태그 라벨 (검색 로그·집계용) */
const TAG_SYNONYM_TO_CANONICAL = (() => {
  const m = new Map();
  for (const [tag, syns] of Object.entries(SEARCH_DICTIONARY.tags || {})) {
    m.set(String(tag).toLowerCase(), tag);
    for (const s of syns || []) {
      m.set(String(s).toLowerCase(), tag);
    }
  }
  return m;
})();

/**
 * `parseSearchQuery` 결과의 tags만 사전 기준으로 정규화 (로그·집계용).
 */
export function normalizeTagsForSearchLog(parsed) {
  const out = [];
  const seen = new Set();
  for (const t of parsed?.tags || []) {
    const s = String(t || "").trim();
    if (!s) continue;
    const canon = TAG_SYNONYM_TO_CANONICAL.get(s.toLowerCase()) || s;
    if (seen.has(canon)) continue;
    seen.add(canon);
    out.push(canon);
  }
  return out;
}

/** 파서 food 축 첫 값 (스칼라 또는 foods[0]) */
export function primaryParsedFood(parsed) {
  if (!parsed) return null;
  if (parsed.food) return String(parsed.food);
  if (Array.isArray(parsed.foods) && parsed.foods[0]) {
    return String(parsed.foods[0]);
  }
  return null;
}
