import { resolvePlaceWgs84, isLikelyKoreaWgs84 } from "./placeCoords";

/**
 * 뷰포트에 여유를 둔 bbox (가장자리 핀 깜빡임 완화)
 */
export function padLatLngBounds(sw, ne, padRatio = 0.12) {
  const lat0 = Number(sw?.lat);
  const lng0 = Number(sw?.lng);
  const lat1 = Number(ne?.lat);
  const lng1 = Number(ne?.lng);
  if (
    !Number.isFinite(lat0) ||
    !Number.isFinite(lng0) ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1)
  ) {
    return null;
  }
  const dLat = (lat1 - lat0) * padRatio;
  const dLng = (lng1 - lng0) * padRatio;
  return {
    sw: { lat: lat0 - dLat, lng: lng0 - dLng },
    ne: { lat: lat1 + dLat, lng: lng1 + dLng },
  };
}

/**
 * bbox 밖 좌표면 제외 (resolvePlaceWgs84는 lat/lng·레거시 y/x 모두 처리)
 */
export function filterJoinRowsToBounds(rows, bounds) {
  const { sw, ne } = bounds;
  if (!sw || !ne || !Array.isArray(rows)) return rows;
  return rows.filter((row) => {
    const p = row?.places;
    if (!p) return false;
    const wgs = resolvePlaceWgs84(p);
    if (!wgs || !isLikelyKoreaWgs84(wgs.lat, wgs.lng)) return false;
    return (
      wgs.lat >= sw.lat &&
      wgs.lat <= ne.lat &&
      wgs.lng >= sw.lng &&
      wgs.lng <= ne.lng
    );
  });
}
