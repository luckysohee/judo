import { fetchMapPlacesInBounds } from "../api/placesInBounds.js";
import { getRegionCenterCoords, mapSearchMaxDistanceKmForLocation } from "./searchParser.js";
import { formatBoundsPlaceRowsForMap } from "./formatBoundsPlaceRowsForMap.js";
import { buildFormattedPlacesFromJoin } from "./buildFormattedPlacesFromJoin.js";
import { attachCuratorsToCuratorPlaceRows } from "../pages/Home/homeModule.js";
import { getAiApiBaseUrl } from "./apiBaseUrl.js";

function boundsAroundCenter(lat, lng, km) {
  const latDelta = km / 111;
  const lngDelta = km / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lng - lngDelta,
    east: lng + lngDelta,
  };
}

/**
 * 지명 코스 검색 — 홈 지도와 동일한 `places-in-bounds`로 해당 권역 장소를 가져온다.
 * 전역 `places` select만 쓰면 뷰포트 밖·좌표 누락으로 0건이 되기 쉽다.
 *
 * @param {string} areaKey `parseCourseQuery.area` (예: 문정)
 * @param {{ curatorRows?: object[], apiBase?: string, limit?: number }} [opts]
 */
export async function fetchCoursePlacesForNamedArea(areaKey, opts = {}) {
  const key = String(areaKey || "").trim();
  if (!key) return [];

  const center = getRegionCenterCoords(key);
  if (!center) return [];

  const radiusKm = Math.max(
    2.5,
    mapSearchMaxDistanceKmForLocation(key),
    3.2
  );
  const bb = boundsAroundCenter(center.lat, center.lng, radiusKm);
  const limit = Math.min(200, Math.max(80, Number(opts.limit) || 150));

  const bundle = await fetchMapPlacesInBounds(
    { ...bb, limit },
    opts.apiBase || getAiApiBaseUrl()
  );

  const plainRows = bundle.places || [];
  const joinRows = bundle.joinRows || [];
  const attached = attachCuratorsToCuratorPlaceRows(
    joinRows,
    Array.isArray(opts.curatorRows) ? opts.curatorRows : []
  );
  const fromJoin = buildFormattedPlacesFromJoin(attached);
  const joinIdSet = new Set(fromJoin.map((p) => String(p.id)));
  const extraPlain = plainRows.filter(
    (r) => r?.id != null && !joinIdSet.has(String(r.id))
  );

  return [...fromJoin, ...formatBoundsPlaceRowsForMap(extraPlain)];
}
