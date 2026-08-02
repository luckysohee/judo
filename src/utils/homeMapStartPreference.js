/** 홈 지도 첫 화면 — 성수(기본) / 내 위치(재방문·설정 시) */

export const HOME_MAP_VISIT_KEY = "judo_has_visited";
export const HOME_MAP_START_MODE_KEY = "judo_map_start_mode";

export const HOME_MAP_START_SEONGSU = "seongsu";
export const HOME_MAP_START_MY_LOCATION = "my_location";

/**
 * @returns {"seongsu"|"my_location"}
 */
export function readHomeMapStartMode() {
  if (typeof localStorage === "undefined") return HOME_MAP_START_SEONGSU;
  try {
    const v = localStorage.getItem(HOME_MAP_START_MODE_KEY);
    return v === HOME_MAP_START_MY_LOCATION
      ? HOME_MAP_START_MY_LOCATION
      : HOME_MAP_START_SEONGSU;
  } catch {
    return HOME_MAP_START_SEONGSU;
  }
}

/**
 * @param {"seongsu"|"my_location"} mode
 */
export function writeHomeMapStartMode(mode) {
  if (typeof localStorage === "undefined") return;
  const next =
    mode === HOME_MAP_START_MY_LOCATION
      ? HOME_MAP_START_MY_LOCATION
      : HOME_MAP_START_SEONGSU;
  try {
    localStorage.setItem(HOME_MAP_START_MODE_KEY, next);
  } catch {
    /* private mode 등 */
  }
}

/**
 * Home 마운트 시 1회 호출. 이전 방문이 있었는지 반환하고, 없으면 방문 표시를 남긴다.
 * @returns {boolean} true = 재방문(두 번째부터)
 */
export function consumeHomeMapReturnVisit() {
  if (typeof localStorage === "undefined") return false;
  try {
    const before = localStorage.getItem(HOME_MAP_VISIT_KEY) === "true";
    if (!before) {
      localStorage.setItem(HOME_MAP_VISIT_KEY, "true");
    }
    return before;
  } catch {
    return false;
  }
}

/** React Strict Mode 이중 마운트에서도 동일 세션 결과를 유지 */
let homeMapReturnVisitSessionCache;

/**
 * 탭(JS 세션)당 1회만 localStorage를 읽고, 그 결과를 재사용한다.
 * @returns {boolean}
 */
export function getHomeMapReturnVisitFlag() {
  if (homeMapReturnVisitSessionCache !== undefined) {
    return homeMapReturnVisitSessionCache;
  }
  homeMapReturnVisitSessionCache = consumeHomeMapReturnVisit();
  return homeMapReturnVisitSessionCache;
}

/** @internal 테스트용 */
export function resetHomeMapReturnVisitSessionCacheForTests() {
  homeMapReturnVisitSessionCache = undefined;
}

/**
 * 재방문이고 시작 지도가 내 위치일 때만 true.
 * @param {boolean} isReturnVisit
 */
export function shouldBootHomeMapAtMyLocation(isReturnVisit) {
  return Boolean(isReturnVisit) && readHomeMapStartMode() === HOME_MAP_START_MY_LOCATION;
}
