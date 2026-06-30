/**
 * 코스 디스커버리 검색: 동네명(성수동·성수역 등)을 클러스터 키(성수)로 정규화하고
 * 인접 지역을 묶어 「근처 지역 코스」로 함께 추천하기 위한 헬퍼.
 *
 * 서버 `/api/courses/search`는 q를 title·area·description·tags에 ilike(%q%)로만 매칭한다.
 * 따라서 "성수동"은 area="성수" 코스를 못 잡으므로, 클러스터 루트("성수")로 정규화해
 * "성수"·"성수동"·"성수동2가"까지 폭넓게 걸리도록 한다.
 */

import {
  findAreaKeywordInQuery,
  getNearbyRegionKeys,
  extractLocationAnchorFromQuery,
  parseSearchQuery,
  regionKeyForLocationToken,
} from "./searchParser.js";

/**
 * 쿼리에서 지역 클러스터 키를 추론. 없으면 null.
 * @param {string} rawQuery
 * @returns {string|null}
 */
export function resolveCourseSearchAreaKey(rawQuery) {
  const text = String(rawQuery || "").trim();
  if (!text) return null;

  try {
    const facets = parseSearchQuery(text);
    if (facets?.region) return facets.region;
  } catch {
    /* noop */
  }

  const hit = findAreaKeywordInQuery(text);
  if (hit) {
    const key = regionKeyForLocationToken(hit);
    if (key) return key;
  }

  const anchor = extractLocationAnchorFromQuery(text);
  if (anchor) {
    const key = regionKeyForLocationToken(anchor);
    if (key) return key;
    const stripped = anchor.replace(/(역|동|구|로|길|거리|시장)$/u, "");
    if (stripped && stripped !== anchor) {
      const k2 = regionKeyForLocationToken(stripped);
      if (k2) return k2;
    }
  }
  return null;
}

/**
 * 매칭된 지역 토큰을 클러스터 키로 치환해 검색어를 정규화.
 * @param {string} rawQuery
 * @param {string} areaKey
 * @returns {string}
 */
function canonicalizeAreaInQuery(rawQuery, areaKey) {
  const text = String(rawQuery || "").trim();
  if (!text || !areaKey) return text;
  const token = findAreaKeywordInQuery(text);
  if (!token || token === areaKey) {
    // 토큰을 못 집으면(예: 동/역 변형) 정규 키만으로 검색
    return text === areaKey ? text : areaKey;
  }
  try {
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const replaced = text
      .replace(new RegExp(esc, "g"), areaKey)
      .replace(/\s+/g, " ")
      .trim();
    return replaced || areaKey;
  } catch {
    return areaKey;
  }
}

/**
 * 디스커버리 검색 실행 계획.
 * @param {string} rawQuery
 * @param {{ nearbyLimit?: number, nearbyMaxKm?: number }} [opts]
 * @returns {{ primaryQuery: string, areaKey: string|null, nearby: { key: string, query: string }[] }}
 */
export function buildCourseDiscoverySearchPlan(rawQuery, opts = {}) {
  const text = String(rawQuery || "").trim();
  const areaKey = resolveCourseSearchAreaKey(text);
  if (!areaKey) {
    return { primaryQuery: text, areaKey: null, nearby: [] };
  }

  const primaryQuery = canonicalizeAreaInQuery(text, areaKey) || areaKey;

  const nearbyLimit = Number.isFinite(Number(opts.nearbyLimit))
    ? Number(opts.nearbyLimit)
    : 3;
  const nearbyMaxKm = Number.isFinite(Number(opts.nearbyMaxKm))
    ? Number(opts.nearbyMaxKm)
    : 4;

  const nearby = getNearbyRegionKeys(areaKey, {
    maxKm: nearbyMaxKm,
    limit: nearbyLimit,
  }).map((key) => ({ key, query: key }));

  return { primaryQuery, areaKey, nearby };
}
