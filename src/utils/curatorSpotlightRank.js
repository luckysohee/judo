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
