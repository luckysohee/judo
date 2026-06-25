import { padLatLngBounds } from "./fetchCuratorPlacesInBounds";
import {
  getHomeMapViewportPlaceLimit,
  HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT,
} from "./homeMapViewportLimit";

/** MapView `DEFAULT_MAP_CENTER` 와 동일 */
export const SEONGSU_MAP_CENTER = { lat: 37.54465, lng: 127.05595 };

/**
 * MapView 초기 level(5) 성수 뷰 — 지도 idle 전 places-in-bounds 선요청용.
 * Kakao level 5 한 화면 ≈ 위도 0.018·경도 0.022(±절반). 줌 아웃(레벨↑)할수록 화면이
 * 2배씩 넓어지므로 `2^(level-5)` 로 bbox를 키운다(레벨 5 = 1배 = 실제 화면 크기).
 */
export function defaultHomeMapViewportBounds(mapLevel = 5) {
  const lat = SEONGSU_MAP_CENTER.lat;
  const lng = SEONGSU_MAP_CENTER.lng;
  const scale = Math.pow(2, Math.max(0, (mapLevel ?? 5) - 5));
  const latHalf = 0.009 * scale;
  const lngHalf = 0.011 * scale;
  return {
    sw: { lat: lat - latHalf, lng: lng - lngHalf },
    ne: { lat: lat + latHalf, lng: lng + lngHalf },
  };
}

/**
 * @param {{ sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }} boundsRaw
 * @param {number} [mapLevel]
 * @param {{ widenForSituation?: boolean, limit?: number, padRatio?: number }} [opts]
 */
export function computeHomeViewportCacheKey(
  boundsRaw,
  mapLevel = 5,
  { widenForSituation = false, limit: limitOverride, padRatio } = {},
) {
  const pad = padRatio ?? (widenForSituation ? 0.24 : 0.12);
  const padded = padLatLngBounds(boundsRaw.sw, boundsRaw.ne, pad);
  if (!padded) return null;

  const level =
    typeof mapLevel === "number" && Number.isFinite(mapLevel) ? mapLevel : 5;
  const limit =
    limitOverride ??
    getHomeMapViewportPlaceLimit(level, { widenForSituation });
  const r4 = (n) => Number(n).toFixed(4);
  const mode = widenForSituation ? "sit" : "all";

  return {
    cacheKey: `${r4(padded.sw.lat)}_${r4(padded.sw.lng)}_${r4(padded.ne.lat)}_${r4(padded.ne.lng)}_${limit}_${mode}`,
    padded,
    south: padded.sw.lat,
    west: padded.sw.lng,
    north: padded.ne.lat,
    east: padded.ne.lng,
    limit,
    level,
    widenForSituation,
    mode,
  };
}

/** 성수 첫 진입(level 5) 세션 캐시 키 — boot limit(40)과 fetch·prefetch 키 일치 */
export function getSeongsuBootViewportCacheKey(mapLevel = 5) {
  return computeHomeViewportCacheKey(
    defaultHomeMapViewportBounds(mapLevel),
    mapLevel,
    { limit: HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT },
  )?.cacheKey;
}
