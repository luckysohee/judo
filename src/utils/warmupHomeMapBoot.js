import { fetchMapPlacesInBounds } from "../api/placesInBounds";
import { getAiApiBaseUrl } from "./apiBaseUrl";
import { loadKakaoMapsSdk } from "./loadKakaoMapsSdk";
import { formatBoundsPlaceRowsForMap } from "./formatBoundsPlaceRowsForMap";
import { writeHomeMapViewportSessionCache } from "./homeMapViewportSessionCache";
import {
  computeHomeViewportCacheKey,
  defaultHomeMapViewportBounds,
} from "./homeMapViewportBounds";
import { HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT } from "./homeMapViewportLimit";

function buildInitialViewportPrefetchParams() {
  const boundsRaw = defaultHomeMapViewportBounds(5);
  const mapLevel = 5;
  const computed = computeHomeViewportCacheKey(boundsRaw, mapLevel, {
    limit: HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT,
  });
  if (!computed) return null;

  return {
    boundsRaw,
    mapLevel,
    cacheKey: computed.cacheKey,
    fetchBounds: {
      south: computed.south,
      west: computed.west,
      north: computed.north,
      east: computed.east,
      limit: computed.limit,
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

/** 앱 마운트 직후 — Kakao SDK + 성수 bbox places-in-bounds 선요청 (밀도는 level≥6에서 Home이 요청) */
export function warmupHomeMapBoot() {
  loadKakaoMapsSdk().catch(() => {});
  void import("../pages/Home/Home");
  void import("../components/Map/MapView");
  void import("./createMarker");
  startViewportPrefetch();
}

/** boot prefetch cacheKey — Home `loadDbPlacesForViewport`와 일치할 때만 await */
export function getHomeViewportPrefetchCacheKey() {
  return buildInitialViewportPrefetchParams()?.cacheKey ?? null;
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
