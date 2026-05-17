import { resolvePlaceWgs84 } from "./placeCoords";

/** 코스 드라이브 스텝 → OSRM waypoints (순서 유지) */
export function courseDriveWaypoints(drive) {
  const steps = Array.isArray(drive?.steps) ? drive.steps : [];
  const out = [];
  for (const s of steps) {
    const w = resolvePlaceWgs84(s?.place);
    if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
    out.push({ lat: w.lat, lng: w.lng });
  }
  return out;
}

/**
 * 코스 드라이브 → 도보 경로 라벨 중간 지점
 * @param {{ lat: number, lng: number }[]} waypoints
 */
export function courseRouteLabelPosition(waypoints, path) {
  if (Array.isArray(path) && path.length > 0) {
    const mid = path[Math.floor(path.length / 2)];
    if (mid && Number.isFinite(Number(mid.lat)) && Number.isFinite(Number(mid.lng))) {
      return { lat: Number(mid.lat), lng: Number(mid.lng) };
    }
  }
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    const mid = waypoints[Math.floor(waypoints.length / 2)];
    return { lat: Number(mid.lat), lng: Number(mid.lng) };
  }
  return null;
}
