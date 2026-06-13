/**
 * 코스 도보 구간: 한강 건너편(북↔남) 후보 제외.
 * 직선거리만 가까운 강 건너 청담·여의도 등을 걸러낸다.
 */

/** 서울 한강 중심선 (서→동, lng·lat) — 대략적 보행 불가 구간 */
const HAN_RIVER_CENTERLINE = [
  { lng: 126.82, lat: 37.532 },
  { lng: 126.9, lat: 37.526 },
  { lng: 126.97, lat: 37.524 },
  { lng: 127.03, lat: 37.527 },
  { lng: 127.08, lat: 37.531 },
  { lng: 127.14, lat: 37.534 },
  { lng: 127.2, lat: 37.536 },
  { lng: 127.26, lat: 37.538 },
  { lng: 127.32, lat: 37.54 },
];

function interpolateRiverLat(lng) {
  if (!Number.isFinite(lng)) return null;
  const pts = HAN_RIVER_CENTERLINE;
  if (lng <= pts[0].lng) return pts[0].lat;
  if (lng >= pts[pts.length - 1].lng) return pts[pts.length - 1].lat;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    if (lng >= a.lng && lng <= b.lng) {
      const t = (lng - a.lng) / (b.lng - a.lng);
      return a.lat + t * (b.lat - a.lat);
    }
  }
  return null;
}

/** 위도가 한강 중심선 기준 북쪽이면 true */
export function isNorthOfHanRiver(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const riverLat = interpolateRiverLat(lng);
  if (riverLat == null) return null;
  return lat > riverLat;
}

/**
 * 도보 코스 앵커→후보 구간이 한강을 건너는지 (양쪽 둑이 다르면 true)
 */
export function courseWalkCrossesHanRiver(fromLat, fromLng, toLat, toLng) {
  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return false;
  }
  const fromNorth = isNorthOfHanRiver(fromLat, fromLng);
  const toNorth = isNorthOfHanRiver(toLat, toLng);
  if (fromNorth == null || toNorth == null) return false;
  return fromNorth !== toNorth;
}
