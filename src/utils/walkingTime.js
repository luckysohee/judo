import { haversineMeters, resolvePlaceWgs84 } from "./placeCoords";

/** 분당 도보 이동 거리(m). 코스 그리드/검색 결과 표기와 동일 베이스라인. */
export const WALKING_METERS_PER_MINUTE = 80;

/**
 * 두 좌표 직선거리 기반 도보 분 (haversine, 80m/분, 최소 1분).
 *
 * @param {{ lat: number, lng: number } | null | undefined} a
 * @param {{ lat: number, lng: number } | null | undefined} b
 * @returns {number | null} 좌표가 부족하면 `null`
 */
export function walkingMinutesBetweenCoords(a, b) {
  if (!a || !b) return null;
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) return null;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null;
  const meters = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  if (!Number.isFinite(meters) || meters < 0) return null;
  return Math.max(1, Math.round(meters / WALKING_METERS_PER_MINUTE));
}

/**
 * `places` 행에서 좌표를 해석한 뒤 도보 분 계산. 한쪽이라도 좌표가 없으면 `null`.
 *
 * @param {object | null | undefined} placeA
 * @param {object | null | undefined} placeB
 * @returns {number | null}
 */
export function walkingMinutesBetweenPlaces(placeA, placeB) {
  const a = resolvePlaceWgs84(placeA);
  const b = resolvePlaceWgs84(placeB);
  return walkingMinutesBetweenCoords(a, b);
}

/**
 * @param {number | null | undefined} minutes
 * @returns {string | null} `"도보 7분"` 형태, 분 값이 없으면 `null`
 */
export function formatWalkingMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return `도보 ${minutes}분`;
}
