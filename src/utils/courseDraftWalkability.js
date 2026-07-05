import { placeKeyForCourseDraftAssist } from "./compactPlacesForCourseDraftAssist.js";
import { haversineMeters, resolvePlaceWgs84 } from "./placeCoords.js";

/** 코스 한 구간 — 이상적인 도보 거리 */
export const COURSE_DRAFT_WALK_IDEAL_M = 1000;
/** 코스 한 구간 — 허용 최대 도보(그 이상은 택시 사유 필요) */
export const COURSE_DRAFT_WALK_MAX_M = 2000;

export function walkingMetersBetweenPlaces(a, b) {
  const wa = resolvePlaceWgs84(a);
  const wb = resolvePlaceWgs84(b);
  if (!wa || !wb) return null;
  return haversineMeters(wa.lat, wa.lng, wb.lat, wb.lng);
}

function placesWithCoords(places) {
  return (Array.isArray(places) ? places : []).filter((p) => resolvePlaceWgs84(p));
}

function centroidOfPlaces(places) {
  const pts = placesWithCoords(places)
    .map((p) => resolvePlaceWgs84(p))
    .filter(Boolean);
  if (!pts.length) return null;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return { lat, lng };
}

/** seed에서 출발해 NN으로 이어 붙인 도보 체인 (구간마다 maxLegM 이하) */
function walkingChainFromSeed(list, seed, maxLegM) {
  const ordered = [seed];
  const rem = list.filter((p) => p !== seed);
  while (rem.length) {
    const last = ordered[ordered.length - 1];
    let best = null;
    let bestD = Infinity;
    for (const p of rem) {
      const d = walkingMetersBetweenPlaces(last, p);
      if (d != null && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best || bestD > maxLegM) break;
    ordered.push(best);
    rem.splice(rem.indexOf(best), 1);
  }
  return ordered;
}

/**
 * 좌표 있는 장소 중 도보로 이어 갈 수 있는 최대 체인만 남김.
 * @param {object[]} places
 * @param {{ maxLegM?: number }} [opts]
 */
export function filterPlacesForWalkableCourseDraft(places, opts = {}) {
  const maxLegM = opts.maxLegM ?? COURSE_DRAFT_WALK_MAX_M;
  const all = Array.isArray(places) ? places.filter(Boolean) : [];
  const list = placesWithCoords(all);
  if (list.length < 2) return all;

  let bestChain = [];
  const seeds = list.slice(0, Math.min(18, list.length));
  for (const seed of seeds) {
    const chain = walkingChainFromSeed(list, seed, maxLegM);
    if (chain.length > bestChain.length) bestChain = chain;
  }

  if (bestChain.length >= 2) {
    const chainKeys = new Set(
      bestChain.map((p) => placeKeyForCourseDraftAssist(p))
    );
    const noCoords = all.filter((p) => !resolvePlaceWgs84(p));
    return [...bestChain, ...noCoords.filter((p) => !chainKeys.has(placeKeyForCourseDraftAssist(p)))];
  }
  return all;
}

/**
 * 도보 동선에 맞게 steps 순서 재배열 (좌표 없는 step은 뒤로).
 * @param {object[]} steps
 * @param {Map<string, object>} placeByKey
 * @param {{ maxLegM?: number }} [opts]
 */
export function orderDraftStepsForWalking(steps, placeByKey, opts = {}) {
  const maxLegM = opts.maxLegM ?? COURSE_DRAFT_WALK_MAX_M;
  const map =
    placeByKey instanceof Map
      ? placeByKey
      : new Map(Object.entries(placeByKey || {}));
  const list = (Array.isArray(steps) ? steps : [])
    .map((s) => {
      const key = String(s?.placeKey || "").trim();
      return { step: s, place: map.get(key), key };
    })
    .filter((row) => row.step && row.place);

  const withCoords = list.filter((row) => resolvePlaceWgs84(row.place));
  const noCoords = list.filter((row) => !resolvePlaceWgs84(row.place));
  if (withCoords.length < 2) return steps;

  const hub = centroidOfPlaces(withCoords.map((r) => r.place));
  let start = withCoords[0];
  if (hub) {
    let bestD = Infinity;
    for (const row of withCoords) {
      const w = resolvePlaceWgs84(row.place);
      const d = haversineMeters(w.lat, w.lng, hub.lat, hub.lng);
      if (d < bestD) {
        bestD = d;
        start = row;
      }
    }
  }

  const ordered = [start];
  const rem = withCoords.filter((r) => r !== start);
  while (rem.length) {
    const lastPlace = ordered[ordered.length - 1].place;
    let best = null;
    let bestD = Infinity;
    for (const row of rem) {
      const d = walkingMetersBetweenPlaces(lastPlace, row.place);
      if (d != null && d < bestD) {
        bestD = d;
        best = row;
      }
    }
    if (!best || bestD > maxLegM) break;
    ordered.push(best);
    rem.splice(rem.indexOf(best), 1);
  }

  return [...ordered, ...rem, ...noCoords].map((r) => r.step);
}

/** 연속 구간 최대 도보(m) */
export function maxWalkingLegMeters(steps, placeByKey) {
  const map =
    placeByKey instanceof Map
      ? placeByKey
      : new Map(Object.entries(placeByKey || {}));
  let max = 0;
  const rows = Array.isArray(steps) ? steps : [];
  for (let i = 1; i < rows.length; i++) {
    const a = map.get(String(rows[i - 1]?.placeKey || "").trim());
    const b = map.get(String(rows[i]?.placeKey || "").trim());
    const d = walkingMetersBetweenPlaces(a, b);
    if (d != null && d > max) max = d;
  }
  return max;
}

/**
 * 구간 2km 초과 step 제거 + 도보 순서 재배열.
 * @param {object|null} draft
 * @param {Map<string, object>} placeByKey
 * @param {{ maxLegM?: number }} [opts]
 */
export function sanitizeCourseDraftForWalkability(draft, placeByKey, opts = {}) {
  const maxLegM = opts.maxLegM ?? COURSE_DRAFT_WALK_MAX_M;
  if (!draft || !Array.isArray(draft.steps) || draft.steps.length < 2) {
    return draft;
  }

  let steps = orderDraftStepsForWalking(draft.steps, placeByKey, { maxLegM });
  const trimmed = [];
  for (const step of steps) {
    if (trimmed.length === 0) {
      trimmed.push(step);
      continue;
    }
    const map =
      placeByKey instanceof Map
        ? placeByKey
        : new Map(Object.entries(placeByKey || {}));
    const prev = map.get(String(trimmed[trimmed.length - 1]?.placeKey || "").trim());
    const cur = map.get(String(step?.placeKey || "").trim());
    const d = walkingMetersBetweenPlaces(prev, cur);
    if (d == null || d <= maxLegM) trimmed.push(step);
  }

  if (trimmed.length >= 2) steps = trimmed;
  if (steps.length < 2) return draft;

  return { ...draft, steps };
}

/**
 * LLM용 compact rows — 허브(후보 중심)까지 도보 거리(m).
 * @param {object[]} compact
 * @param {object[]} sourcePlaces
 */
export function annotateCompactPlacesWithWalkHints(compact, sourcePlaces) {
  const map = new Map();
  for (const p of Array.isArray(sourcePlaces) ? sourcePlaces : []) {
    const k = placeKeyForCourseDraftAssist(p);
    if (k && !map.has(k)) map.set(k, p);
  }
  const hub = centroidOfPlaces([...map.values()]);
  return (Array.isArray(compact) ? compact : []).map((row) => {
    const p = map.get(String(row?.placeKey || "").trim());
    const w = p ? resolvePlaceWgs84(p) : null;
    const walkFromHubM =
      w && hub
        ? Math.round(haversineMeters(w.lat, w.lng, hub.lat, hub.lng))
        : null;
    return {
      ...row,
      ...(walkFromHubM != null ? { walkFromHubM } : {}),
    };
  });
}

export function formatWalkMetersForUi(meters) {
  const m = Math.round(Number(meters) || 0);
  if (m <= 0) return "";
  if (m >= 1000) return `약 ${(m / 1000).toFixed(1)}km`;
  return `약 ${m}m`;
}
