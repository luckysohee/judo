import { haversineMeters, resolvePlaceWgs84 } from "./placeCoords";

/**
 * 맛집첩 핀 fitBounds용 — 중앙값 기준 반경 밖 이상치(다른 구 한 곳 등)를 빼서
 * 동네 묶음이 한 화면에 들어오게 한다.
 * @param {unknown[]} places
 * @param {{ maxRadiusM?: number }} [opts]
 * @returns {object[]}
 */
export function pickMainClusterPlacesForMapFit(places, opts = {}) {
  const rows = (Array.isArray(places) ? places : [])
    .map((p) => {
      const w = resolvePlaceWgs84(p);
      if (!w) return null;
      return { p, lat: w.lat, lng: w.lng };
    })
    .filter(Boolean);
  if (rows.length <= 1) return rows.map((r) => r.p);

  const maxRadiusM = Math.max(
    800,
    Number(opts.maxRadiusM) > 0 ? Number(opts.maxRadiusM) : 3500
  );

  const lats = rows.map((r) => r.lat).sort((a, b) => a - b);
  const lngs = rows.map((r) => r.lng).sort((a, b) => a - b);
  const mid = Math.floor(rows.length / 2);
  const medLat = lats[mid];
  const medLng = lngs[mid];

  const within = (radiusM) =>
    rows.filter(
      (r) => haversineMeters(medLat, medLng, r.lat, r.lng) <= radiusM
    );

  let kept = within(maxRadiusM);
  const minKeep = Math.max(2, Math.ceil(rows.length * 0.55));
  if (kept.length < minKeep) {
    kept = within(maxRadiusM * 2);
  }
  if (kept.length === 0) return rows.map((r) => r.p);
  return kept.map((r) => r.p);
}
