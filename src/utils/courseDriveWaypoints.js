import { resolvePlaceWgs84 } from "./placeCoords";

/** 경로 라벨 박스가 폴리라인 위에 겹치지 않도록 옆으로 띄우는 거리(m) */
export const COURSE_ROUTE_LABEL_OFFSET_M = 62;

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

function normalizePathPoint(p) {
  if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) {
    return null;
  }
  return { lat: Number(p.lat), lng: Number(p.lng) };
}

/** @param {{ lat: number, lng: number }} a @param {{ lat: number, lng: number }} b */
function bearingDegrees(a, b) {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} bearingDeg
 * @param {number} distM
 */
function destinationPoint(lat, lng, bearingDeg, distM) {
  const R = 6371000;
  const δ = distM / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * 경로 중간 구간의 접선에 수직으로 라벨 앵커를 둠 — 거리·시간 박스가 루트를 덮지 않게.
 * @param {{ lat: number, lng: number }[]} [waypoints]
 * @param {{ lat: number, lng: number }[]} [path]
 * @param {{ offsetMeters?: number, perpendicularDeg?: 90|-90 }} [opts]
 */
export function courseRouteLabelPosition(waypoints, path, opts = {}) {
  const offsetM = Number(opts.offsetMeters) || COURSE_ROUTE_LABEL_OFFSET_M;
  const perp =
    Number(opts.perpendicularDeg) === -90 ? -90 : 90;
  const raw =
    Array.isArray(path) && path.length >= 2
      ? path
      : Array.isArray(waypoints) && waypoints.length >= 2
        ? waypoints
        : null;
  if (!raw) return null;

  const pts = raw.map(normalizePathPoint).filter(Boolean);
  if (pts.length < 2) return null;

  const segIdx = Math.max(0, Math.floor((pts.length - 1) / 2));
  const a = pts[segIdx];
  const b = pts[Math.min(segIdx + 1, pts.length - 1)];
  const midLat = (a.lat + b.lat) / 2;
  const midLng = (a.lng + b.lng) / 2;
  const along = bearingDegrees(a, b);
  return destinationPoint(midLat, midLng, along + perp, offsetM);
}
