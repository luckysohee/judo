import { readHomeStartCourseFollowId } from "./homeCourseFollowNavigation";
import { readHomeCuratorPlaceFocusState } from "./homeCuratorPlaceNavigation";
import {
  computeHomeViewportCacheKey,
  getSeongsuBootViewportCacheKey,
} from "./homeMapViewportBounds";
import { HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT } from "./homeMapViewportLimit";
import {
  readHomeMapViewportSessionCacheForBoot,
  readHomeMapViewportSessionCacheMatching,
} from "./homeMapViewportSessionCache";

export const HOME_MAP_WINDOW_SESSION_KEY = "judo_map_window_v1";
/** 스튜디오·상세를 오래 보다가 돌아와도 카메라가 유지되게 장소 캐시(12분)보다 길게 둔다. */
export const HOME_MAP_WINDOW_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const KOREA_LAT_MIN = 32;
const KOREA_LAT_MAX = 43;
const KOREA_LNG_MIN = 124;
const KOREA_LNG_MAX = 133;
const KAKAO_LEVEL_MIN = 1;
const KAKAO_LEVEL_MAX = 14;

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function isKoreaLatLng(lat, lng) {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    lat >= KOREA_LAT_MIN &&
    lat <= KOREA_LAT_MAX &&
    lng >= KOREA_LNG_MIN &&
    lng <= KOREA_LNG_MAX
  );
}

function isValidBounds(bounds) {
  const swLat = bounds?.sw?.lat;
  const swLng = bounds?.sw?.lng;
  const neLat = bounds?.ne?.lat;
  const neLng = bounds?.ne?.lng;
  if (
    !isKoreaLatLng(swLat, swLng) ||
    !isKoreaLatLng(neLat, neLng) ||
    swLat >= neLat ||
    swLng >= neLng
  ) {
    return false;
  }
  return true;
}

/**
 * @param {unknown} value
 * @returns {{ lat: number, lng: number, level: number, bounds: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } } } | null}
 */
export function normalizeHomeMapWindow(value) {
  if (!value || typeof value !== "object") return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  const level = Number(value.level);
  if (!isKoreaLatLng(lat, lng)) return null;
  if (
    !isFiniteNumber(level) ||
    level < KAKAO_LEVEL_MIN ||
    level > KAKAO_LEVEL_MAX
  ) {
    return null;
  }
  const bounds = value.bounds;
  if (!isValidBounds(bounds)) return null;
  return {
    lat,
    lng,
    level,
    bounds: {
      sw: { lat: Number(bounds.sw.lat), lng: Number(bounds.sw.lng) },
      ne: { lat: Number(bounds.ne.lat), lng: Number(bounds.ne.lng) },
    },
  };
}

function readStorageItem(key) {
  try {
    if (typeof sessionStorage !== "undefined") {
      const raw = sessionStorage.getItem(key);
      if (raw) return raw;
    }
  } catch {
    /* private mode */
  }
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    /* private mode */
  }
  return null;
}

function writeStorageItem(key, value) {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, value);
    }
  } catch {
    /* quota / private */
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    /* quota / private */
  }
}

function removeStorageItem(key) {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

function parseStoredWindow(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const age = Date.now() - Number(parsed?.ts || 0);
    if (age < 0 || age >= HOME_MAP_WINDOW_SESSION_TTL_MS) return null;
    return normalizeHomeMapWindow(parsed);
  } catch {
    return null;
  }
}

/** @returns {{ lat: number, lng: number, level: number, bounds: object } | null} */
export function readHomeMapWindowSession() {
  return parseStoredWindow(readStorageItem(HOME_MAP_WINDOW_SESSION_KEY));
}

/** @param {{ lat?: number, lng?: number, level?: number, bounds?: object }} payload */
export function writeHomeMapWindowSession(payload) {
  const win = normalizeHomeMapWindow(payload);
  if (!win) return false;
  writeStorageItem(
    HOME_MAP_WINDOW_SESSION_KEY,
    JSON.stringify({ ts: Date.now(), ...win }),
  );
  return true;
}

export function clearHomeMapWindowSession() {
  removeStorageItem(HOME_MAP_WINDOW_SESSION_KEY);
}

/**
 * 복원 카메라에 맞는 places-in-bounds 세션 캐시 키 (boot limit + 줌 limit).
 * @param {{ bounds: object, level: number }} win
 * @returns {string[]}
 */
export function homeMapWindowPlaceCacheKeys(win) {
  if (!win?.bounds) return [];
  const level = Number.isFinite(win.level) ? win.level : 5;
  const boot = computeHomeViewportCacheKey(win.bounds, level, {
    limit: HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT,
  });
  const full = computeHomeViewportCacheKey(win.bounds, level);
  return [...new Set([boot?.cacheKey, full?.cacheKey].filter(Boolean))];
}

/**
 * 홈 재마운트 시 쓸 카메라. 코스 따라가기·큐레이터 장소 포커스는 복원보다 우선.
 * @param {unknown} locationState
 */
export function resolveHomeMapBootWindow(locationState) {
  if (readHomeStartCourseFollowId(locationState)) return null;
  if (readHomeCuratorPlaceFocusState(locationState)) return null;
  return readHomeMapWindowSession();
}

/**
 * 부트 마커: 복원 창이면 그 뷰포트 캐시만, 아니면 성수 첫 진입 캐시.
 * @param {{ bounds: object, level: number } | null | undefined} restoredWindow
 */
export function readHomeMapBootPlaceCache(restoredWindow) {
  if (restoredWindow) {
    return readHomeMapViewportSessionCacheMatching(
      homeMapWindowPlaceCacheKeys(restoredWindow),
    );
  }
  return readHomeMapViewportSessionCacheForBoot(getSeongsuBootViewportCacheKey(5));
}
