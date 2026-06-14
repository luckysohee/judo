import { fetchMapPlacesInBounds } from "../api/placesInBounds";
import { fetchMapPlaceDensityInBounds } from "../api/placesDensityInBounds";
import { getHomeMapViewportPlaceLimit } from "./homeMapViewportLimit";
import { getAiApiBaseUrl } from "./apiBaseUrl";
import { padLatLngBounds } from "./fetchCuratorPlacesInBounds";
import { loadKakaoMapsSdk } from "./loadKakaoMapsSdk";
import { formatBoundsPlaceRowsForMap } from "./formatBoundsPlaceRowsForMap";
import { writeHomeMapViewportSessionCache } from "./homeMapViewportSessionCache";
import { defaultHomeMapViewportBounds } from "./homeMapViewportBounds";

function buildInitialViewportPrefetchParams() {
  const boundsRaw = defaultHomeMapViewportBounds(5);
  const mapLevel = 5;
  const padded = padLatLngBounds(boundsRaw.sw, boundsRaw.ne, 0.12);
  if (!padded) return null;

  const limit = getHomeMapViewportPlaceLimit(mapLevel);
  const r4 = (n) => Number(n).toFixed(4);
  const cacheKey = `${r4(padded.sw.lat)}_${r4(padded.sw.lng)}_${r4(padded.ne.lat)}_${r4(padded.ne.lng)}_${limit}_all`;

  return {
    boundsRaw,
    mapLevel,
    cacheKey,
    fetchBounds: {
      south: padded.sw.lat,
      west: padded.sw.lng,
      north: padded.ne.lat,
      east: padded.ne.lng,
      limit,
    },
  };
}

let viewportPrefetchPromise = null;

function startViewportPrefetch() {
  if (viewportPrefetchPromise) return viewportPrefetchPromise;

  const params = buildInitialViewportPrefetchParams();
  if (!params) {
    viewportPrefetchPromise = Promise.resolve(null);
    return viewportPrefetchPromise;
  }

  viewportPrefetchPromise = fetchMapPlacesInBounds(
    params.fetchBounds,
    getAiApiBaseUrl(),
  )
    .then((bundle) => {
      const result = {
        ...params,
        plainRows: bundle.places,
        joinRows: bundle.joinRows,
      };
      if (Array.isArray(result.plainRows) && result.plainRows.length > 0) {
        writeHomeMapViewportSessionCache({
          cacheKey: params.cacheKey,
          plainRows: result.plainRows,
          joinRows: result.joinRows || [],
          merged: formatBoundsPlaceRowsForMap(result.plainRows),
        });
      }
      return result;
    })
    .catch((err) => {
      viewportPrefetchPromise = null;
      if (import.meta.env.DEV) {
        console.warn("[warmupHomeMapBoot] viewport prefetch failed:", err);
      }
      return null;
    });

  return viewportPrefetchPromise;
}

/** 앱 마운트 직후 — Kakao SDK + 성수 기본 bbox places·밀도 병렬 선요청 */
export function warmupHomeMapBoot() {
  loadKakaoMapsSdk().catch(() => {});
  startViewportPrefetch();
  const params = buildInitialViewportPrefetchParams();
  if (params?.fetchBounds) {
    void fetchMapPlaceDensityInBounds(
      { ...params.fetchBounds, level: 7 },
      getAiApiBaseUrl(),
    ).catch(() => {});
  }
}

/** @returns {Promise<{ cacheKey: string, plainRows: object[], joinRows: object[] } | null> | null} */
export function peekHomeViewportPrefetch() {
  return viewportPrefetchPromise;
}

/**
 * 선요청 결과 1회 소비 — Home `loadDbPlacesForViewport` 에서 cacheKey 일치 시 fetch 생략.
 * @returns {Promise<{ cacheKey: string, plainRows: object[], joinRows: object[] } | null> | null}
 */
export function takeHomeViewportPrefetch() {
  const pending = viewportPrefetchPromise;
  viewportPrefetchPromise = null;
  return pending;
}
