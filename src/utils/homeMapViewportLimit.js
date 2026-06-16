/** 서버 RPC·API 상한과 동기화 */
export const HOME_MAP_VIEWPORT_LIMIT_CAP = 200;

/** 성수 첫 화면(level 5)·줌 아웃 */
export const HOME_MAP_VIEWPORT_LIMIT_DEFAULT = 120;

/** 앱 첫 진입(boot) — SVG 마커 페인트 CPU 비용 때문에 적게 시작 */
export const HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT = 40;

/** 줌 인(level ≤ 4) */
export const HOME_MAP_VIEWPORT_LIMIT_ZOOMED_IN = 200;

/** Kakao level ≥ 6 — 숫자 밀도 클러스터 레이어 (상세 마커 대신) */
export const HOME_MAP_DENSITY_LAYER_MIN_LEVEL = 6;

/**
 * Kakao 지도 level — 숫자 클수록 멀리(줌 아웃).
 * @param {number} mapLevel
 * @param {{ hasCuratorChipFilter?: boolean, widenForSituation?: boolean }} [opts]
 */
export function getHomeMapViewportPlaceLimit(
  mapLevel,
  { hasCuratorChipFilter = false, widenForSituation = false } = {},
) {
  const level =
    typeof mapLevel === "number" && Number.isFinite(mapLevel) ? mapLevel : 6;

  if (hasCuratorChipFilter) {
    const capByZoom = level >= 8 ? 150 : level >= 6 ? 180 : HOME_MAP_VIEWPORT_LIMIT_CAP;
    return Math.min(HOME_MAP_VIEWPORT_LIMIT_CAP, capByZoom);
  }

  if (widenForSituation) {
    const base = level <= 4 ? HOME_MAP_VIEWPORT_LIMIT_ZOOMED_IN : HOME_MAP_VIEWPORT_LIMIT_DEFAULT;
    return Math.min(HOME_MAP_VIEWPORT_LIMIT_CAP, Math.round(base * 1.5));
  }

  if (level <= 4) return HOME_MAP_VIEWPORT_LIMIT_ZOOMED_IN;
  return HOME_MAP_VIEWPORT_LIMIT_DEFAULT;
}

/** @param {{ sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }} inner */
export function boundsFullyInside(inner, outer) {
  if (!inner?.sw || !inner?.ne || !outer?.sw || !outer?.ne) return false;
  return (
    inner.sw.lat >= outer.sw.lat &&
    inner.ne.lat <= outer.ne.lat &&
    inner.sw.lng >= outer.sw.lng &&
    inner.ne.lng <= outer.ne.lng
  );
}

/**
 * 직전 fetch padded bbox 안이면 재요청 생략 (팬·미세 줌).
 * @param {{ boundsRaw: object, limit: number, hasCuratorChipFilter: boolean, widenForSituation: boolean, curatorCacheKey?: string }} next
 * @param {{ padded: object, limit: number, hasCuratorChipFilter: boolean, widenForSituation: boolean, curatorCacheKey?: string } | null} last
 */
export function shouldSkipMapViewportRefetch(next, last) {
  if (!last?.padded) return false;
  if (next.limit !== last.limit) return false;
  if (next.hasCuratorChipFilter !== last.hasCuratorChipFilter) return false;
  if (next.widenForSituation !== last.widenForSituation) return false;
  if ((next.curatorCacheKey || "") !== (last.curatorCacheKey || "")) return false;

  const latSpan = last.padded.ne.lat - last.padded.sw.lat;
  const lngSpan = last.padded.ne.lng - last.padded.sw.lng;
  const margin = 0.12;
  const inner = {
    sw: {
      lat: last.padded.sw.lat + latSpan * margin,
      lng: last.padded.sw.lng + lngSpan * margin,
    },
    ne: {
      lat: last.padded.ne.lat - latSpan * margin,
      lng: last.padded.ne.lng - lngSpan * margin,
    },
  };
  return boundsFullyInside(next.boundsRaw, inner);
}
