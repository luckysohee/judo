export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

/**
 * 체크인 거리 검증: y/x와 lat/lng가 둘 다 있으면서 어긋나면, 사용자 GPS에 더 가까운 쌍을 쓴다.
 * (지도·저장은 lat/lng가 맞는데 카카오 y/x만 오래된 경우 오탐 방지)
 */
export function pickCheckinPlaceCoordsNearUser(place, userLat, userLng) {
  if (!place || typeof place !== "object") return null;
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return null;
  const y = parseFloat(place.y);
  const x = parseFloat(place.x);
  const la = parseFloat(place.lat);
  const ln = parseFloat(place.lng);
  const hasYx = Number.isFinite(y) && Number.isFinite(x);
  const hasLL = Number.isFinite(la) && Number.isFinite(ln);
  if (!hasYx && !hasLL) return null;
  if (!hasLL) return { lat: y, lng: x };
  if (!hasYx) return { lat: la, lng: ln };
  const dYx = haversineMeters(userLat, userLng, y, x);
  const dLL = haversineMeters(userLat, userLng, la, ln);
  if (Math.abs(dYx - dLL) < 30) return { lat: y, lng: x };
  return dLL <= dYx ? { lat: la, lng: ln } : { lat: y, lng: x };
}

/** 카카오 로컬 숫자 장소 id만 (UUID가 place_id에 들어간 행은 제외) */
export function kakaoNumericPlaceId(place) {
  if (!place || typeof place !== "object") return null;
  const candidates = [
    place.kakao_place_id,
    place.place_id,
    place.kakaoId,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const s = String(c).trim();
    if (/^\d+$/.test(s)) return s;
  }
  return null;
}
