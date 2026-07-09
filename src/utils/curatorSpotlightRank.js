import {
  computeSpotlightEngagementScore,
  placeKeyForFeedback,
} from "./searchPlaceFeedback.js";

function isUuidLike(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s || "")
  );
}

/** engagement map 키 후보 — UUID·카카오 id 양쪽 */
function engagementKeysForPlace(place) {
  const keys = new Set();
  const pk = placeKeyForFeedback(place);
  if (pk) keys.add(pk);
  const raw = place?.id ?? place?.place_id;
  if (raw != null && String(raw).trim()) {
    const s = String(raw).trim();
    keys.add(s);
    if (isUuidLike(s)) keys.add(s.toLowerCase());
  }
  const kid = place?.kakao_place_id ?? place?.kakaoId;
  if (kid != null && String(kid).trim()) keys.add(String(kid).trim());
  return [...keys];
}

export function getPlaceSearchEngagement(place, engagementMap = {}) {
  let impressions = 0;
  let clicks = 0;
  for (const k of engagementKeysForPlace(place)) {
    const row = engagementMap[k];
    if (!row) continue;
    impressions += row.impressions || 0;
    clicks += row.clicks || 0;
  }
  return { impressions, clicks };
}

export function isCuratorSpotlightCandidate(place, engagementMap = {}) {
  if (!place || typeof place !== "object") return false;
  if (Number(place.curatorCount) >= 1) return true;
  const { impressions, clicks } = getPlaceSearchEngagement(place, engagementMap);
  return clicks > 0 || impressions >= 4;
}

/**
 * 검색 반응이 큰 place_key — 현재 지도 마커에 없어도 스포트라이트 후보로 쓸 키.
 * @param {Record<string, { impressions?: number, clicks?: number }>} engagementMap
 * @param {object[]} [viewportPlaces] 이미 지도에 있는 장소(중복 키 제외)
 * @param {{ limit?: number, minClicks?: number, minImpressions?: number }} [opts]
 * @returns {string[]}
 */
export function pickOffMapEngagementKeys(
  engagementMap,
  viewportPlaces = [],
  opts = {}
) {
  const limit = Math.max(1, Math.min(80, Number(opts.limit) || 40));
  const minClicks = Math.max(0, Number(opts.minClicks) || 1);
  const minImpressions = Math.max(0, Number(opts.minImpressions) || 4);

  const viewportKeys = new Set();
  for (const p of Array.isArray(viewportPlaces) ? viewportPlaces : []) {
    for (const k of engagementKeysForPlace(p)) viewportKeys.add(k);
  }

  const candidates = [];
  for (const [rawKey, row] of Object.entries(engagementMap || {})) {
    const key = String(rawKey || "").trim();
    if (!key || viewportKeys.has(key)) continue;
    const clicks = Math.max(0, Number(row?.clicks) || 0);
    const impressions = Math.max(0, Number(row?.impressions) || 0);
    if (clicks < minClicks && impressions < minImpressions) continue;
    candidates.push({
      key,
      score: computeSpotlightEngagementScore(impressions, clicks),
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return candidates.slice(0, limit).map((c) => c.key);
}

/**
 * 뷰포트 마커 + 검색 인기(오프맵) 장소 풀 합치기.
 * @param {object[]} viewportPlaces
 * @param {object[]} offMapPlaces
 */
export function mergeSpotlightPlacePools(viewportPlaces, offMapPlaces) {
  const byId = new Map();
  const ingest = (p) => {
    if (!p || typeof p !== "object") return;
    const id = String(p.id ?? p.place_id ?? "").trim();
    if (!id) return;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, p);
      return;
    }
    const nextCc = Number(p.curatorCount) || 0;
    const prevCc = Number(prev.curatorCount) || 0;
    if (nextCc > prevCc) byId.set(id, { ...prev, ...p });
    else byId.set(id, { ...p, ...prev });
  };
  for (const p of Array.isArray(viewportPlaces) ? viewportPlaces : []) ingest(p);
  for (const p of Array.isArray(offMapPlaces) ? offMapPlaces : []) ingest(p);
  return [...byId.values()];
}

/** DB `places` 행 → 스포트라이트 칩용 (지도 포맷과 호환) */
export function formatPlaceRowForSpotlight(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.id != null ? String(row.id).trim() : "";
  if (!id) return null;
  const kid =
    row.kakao_place_id != null ? String(row.kakao_place_id).trim() : "";
  return {
    id,
    name: row.name ?? "",
    lat: row.lat,
    lng: row.lng,
    x: row.lng != null ? String(row.lng) : undefined,
    y: row.lat != null ? String(row.lat) : undefined,
    category: (row.category && String(row.category).trim()) || "미분류",
    category_name: "",
    phone: "",
    address: row.address || "",
    address_name: "",
    road_address_name: "",
    place_url: "",
    place_id: id,
    kakao_place_id: kid || null,
    kakaoId: kid || null,
    isKakaoPlace: Boolean(kid),
    curatorCount: Number(row.curatorCount) || 0,
    curators: [],
    curatorUsernames: [],
    curatorReasons: {},
    curatorPlaces: [],
    comment: "",
    savedCount: 0,
    tags: Array.isArray(row.tags) ? row.tags : [],
    moods: [],
    vibes: [],
    is_public: true,
  };
}

export function computeCuratorSpotlightScore(place, engagementMap = {}) {
  const curator = Math.max(0, Number(place?.curatorCount) || 0);
  const { impressions, clicks } = getPlaceSearchEngagement(place, engagementMap);
  const engagement = computeSpotlightEngagementScore(impressions, clicks);
  return curator * 8 + engagement;
}

function fnvHashPlaceId(place, salt) {
  const s = String(place?.id ?? place?.place_id ?? "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h ^ salt) >>> 0;
}

/**
 * @param {object[]} dbPlaces
 * @param {Record<string, { impressions: number, clicks: number }>} engagementMap
 * @param {number} salt — 세션 로테이션
 * @returns {object[]}
 */
export function rankCuratorSpotlightPlaces(dbPlaces, engagementMap, salt = 0) {
  const ranked = (Array.isArray(dbPlaces) ? dbPlaces : [])
    .filter((p) => isCuratorSpotlightCandidate(p, engagementMap))
    .sort((a, b) => {
      const ds =
        computeCuratorSpotlightScore(b, engagementMap) -
        computeCuratorSpotlightScore(a, engagementMap);
      if (ds !== 0) return ds;
      const dc = (b.curatorCount || 0) - (a.curatorCount || 0);
      if (dc !== 0) return dc;
      const ta = fnvHashPlaceId(a, salt);
      const tb = fnvHashPlaceId(b, salt);
      if (ta !== tb) return ta < tb ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  const pool = ranked.slice(0, 56);
  const win = 12;
  const n = pool.length;
  if (n <= win) return pool;
  const maxOff = n - win;
  const off = (salt % (maxOff + 1)) | 0;
  return pool.slice(off, off + win);
}
