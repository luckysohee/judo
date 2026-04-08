/**
 * 카카오 로컬 API 및 DB 장소 공통: y=위도, x=경도.
 * DB lat/lng가 오래됐을 수 있으므로 y/x를 우선한다.
 */
export function resolvePlaceWgs84(place) {
  if (!place || typeof place !== "object") return null;
  const lat = parseFloat(place.y ?? place.lat ?? place.latitude);
  const lng = parseFloat(place.x ?? place.lng ?? place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
