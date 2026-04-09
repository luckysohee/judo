import {
  placeSignalsYajangCuratorMeta,
  parseSearchQuery,
  queryWantsYajangFocus,
  representativePlaceTag,
} from "./searchParser.js";
import { resolvePlaceWgs84 } from "./placeCoords.js";

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 검색 실패·무결과 시: 기준점 기준 반경 안 큐레이터 야장 태그 장소.
 * @param {{ lat: number, lng: number }} origin
 * @param {object[]} catalog — Home `dbPlaces`·customPlaces 등
 * @param {{ maxMeters?: number, limit?: number }} [opts]
 */
export function pickCuratorYajangFallbackPlaces(origin, catalog, opts = {}) {
  const maxM = opts.maxMeters ?? 5000;
  const limit = opts.limit ?? 8;
  if (
    !origin ||
    !Number.isFinite(Number(origin.lat)) ||
    !Number.isFinite(Number(origin.lng))
  ) {
    return [];
  }
  const olat = Number(origin.lat);
  const olng = Number(origin.lng);
  if (!Array.isArray(catalog) || catalog.length === 0) return [];

  const rows = [];
  for (const p of catalog) {
    if (!placeSignalsYajangCuratorMeta(p)) continue;
    if (p?.is_public === false) continue;
    const w = resolvePlaceWgs84(p);
    if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
    const d = haversineMeters(olat, olng, w.lat, w.lng);
    if (!Number.isFinite(d) || d > maxM) continue;
    rows.push({ place: p, distanceM: d });
  }
  rows.sort((a, b) => a.distanceM - b.distanceM);
  return rows.slice(0, limit).map(({ place, distanceM }) => ({
    ...place,
    distance: Math.round(distanceM),
    isYajangCuratorFallback: true,
  }));
}

/**
 * 지도·시트용 — `calculateLocalAIScores`와 비슷한 필드 (id는 UUID 유지)
 */
export function shapeCuratorYajangFallbackForSearchResults(rows, query) {
  const q = String(query || "").trim();
  return rows.map((p) => {
    const lat = parseFloat(p.y ?? p.lat);
    const lng = parseFloat(p.x ?? p.lng);
    const km = p.distance >= 1000
      ? `${(p.distance / 1000).toFixed(1)}km`
      : `${Math.round(p.distance)}m`;
    const name = p.name || p.place_name || "장소";
    return {
      ...p,
      place_name: name,
      y: lat,
      x: lng,
      lat,
      lng,
      category_name: p.category_name || p.category || "",
      aiScore: 90,
      whyRecommended: "큐레이터 야장",
      recommendation: `약 ${km} · 큐레이터 태그 야장${q ? ` · «${q.slice(0, 20)}${q.length > 20 ? "…" : ""}»` : ""}`,
      matchedFacetLabels: ["야장", "큐레이터"],
      searchRepresentativeTag: representativePlaceTag({
        ...p,
        category_name: p.category_name || p.category,
      }),
      estimatedCapacity: 20,
      atmosphere: "일반적인",
      kakao_place_id: p.kakao_place_id ?? null,
      id: p.id,
      isExternal: true,
      isKakaoPlace: Boolean(p.isKakaoPlace || p.kakao_place_id || p.place_url),
      isYajangCuratorFallback: true,
      source: "curator_yajang_fallback",
    };
  });
}

export const YAJANG_FALLBACK_RADIUS_M = 5000;
export const YAJANG_FALLBACK_MAX_RESULTS = 8;

/**
 * 카카오·통합 검색이 비었을 때만: 야장 의도면 5km 이내 큐레이터 태그 야장 후보로 채움.
 */
export function applyYajangCuratorFallbackIfEmpty(origin, catalog, query, scoredPlaces) {
  if (Array.isArray(scoredPlaces) && scoredPlaces.length > 0) {
    return { scoredPlaces, banner: null, usedFallback: false };
  }
  const q = String(query || "").trim();
  if (!q || !queryWantsYajangFocus(q, parseSearchQuery(q))) {
    return { scoredPlaces: scoredPlaces || [], banner: null, usedFallback: false };
  }
  const raw = pickCuratorYajangFallbackPlaces(origin, catalog, {
    maxMeters: YAJANG_FALLBACK_RADIUS_M,
    limit: YAJANG_FALLBACK_MAX_RESULTS,
  });
  if (raw.length === 0) {
    return { scoredPlaces: scoredPlaces || [], banner: null, usedFallback: false };
  }
  const shaped = shapeCuratorYajangFallbackForSearchResults(raw, q);
  return {
    scoredPlaces: shaped,
    banner: {
      title: "근처 검색에는 야장 후보가 없어요",
      body: `5km 안에서 큐레이터가 태그한 야장·야외 술집 ${shaped.length}곳을 모았어요. 조금 멀 수 있어요.`,
    },
    usedFallback: true,
  };
}
