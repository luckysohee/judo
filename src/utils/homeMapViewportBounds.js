/** MapView `DEFAULT_MAP_CENTER` 와 동일 */
export const SEONGSU_MAP_CENTER = { lat: 37.54465, lng: 127.05595 };

/** MapView 초기 level(5) 성수 뷰 — 지도 idle 전 places-in-bounds 선요청용 */
export function defaultHomeMapViewportBounds(mapLevel = 5) {
  const lat = SEONGSU_MAP_CENTER.lat;
  const lng = SEONGSU_MAP_CENTER.lng;
  const scale = Math.pow(2, Math.max(0, 8 - mapLevel));
  const latHalf = 0.009 * scale;
  const lngHalf = 0.011 * scale;
  return {
    sw: { lat: lat - latHalf, lng: lng - lngHalf },
    ne: { lat: lat + latHalf, lng: lng + lngHalf },
  };
}
