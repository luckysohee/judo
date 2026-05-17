// 비우면 Vite `/api` → server 프록시 (kakaoAPIProxy와 동일 규칙)
const API_BASE_URL = (
  import.meta.env.VITE_AI_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/$/, "");

/**
 * 1차→2차 보행 경로 폴리라인 (서버 OSRM 프록시).
 * @returns {Promise<{ ok: true, path: {lat,lng}[], distanceMeters: number, durationSeconds: number } | { ok: false, error?: string }>}
 */
export async function fetchCourseWalkingRoute(slat, slng, dlat, dlng) {
  const q = new URLSearchParams({
    slat: String(slat),
    slng: String(slng),
    dlat: String(dlat),
    dlng: String(dlng),
  });
  const path = API_BASE_URL
    ? `${API_BASE_URL}/api/course-walking-route?${q}`
    : `/api/course-walking-route?${q}`;
  try {
    const r = await fetch(path);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return { ok: false, error: data?.error || "http" };
    }
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
}

function appendWalkingPathSegment(basePath, nextSegment) {
  if (!Array.isArray(nextSegment) || nextSegment.length === 0) return basePath;
  const norm = (p) => ({
    lat: Number(p.lat),
    lng: Number(p.lng),
  });
  const seg = nextSegment.map(norm).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (!seg.length) return basePath;
  if (!basePath.length) return seg;
  const last = basePath[basePath.length - 1];
  const first = seg[0];
  const eps = 1e-5;
  const same =
    Math.abs(last.lat - first.lat) < eps &&
    Math.abs(last.lng - first.lng) < eps;
  return same ? [...basePath, ...seg.slice(1)] : [...basePath, ...seg];
}

/**
 * 1차→쩜오→2차 등 다구간 보행 경로를 OSRM로 각각 받아 이어 붙임.
 * @param {{ lat: number, lng: number }[]} waypoints 순서대로 최소 2개
 * @returns {Promise<{ ok: true, path: {lat,lng}[], distanceMeters: number, durationSeconds: number } | null>}
 */
export async function fetchChainedCourseWalkingRoutes(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
  const legs = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (
      !a ||
      !b ||
      !Number.isFinite(Number(a.lat)) ||
      !Number.isFinite(Number(a.lng)) ||
      !Number.isFinite(Number(b.lat)) ||
      !Number.isFinite(Number(b.lng))
    ) {
      return null;
    }
    legs.push(
      fetchCourseWalkingRoute(
        Number(a.lat),
        Number(a.lng),
        Number(b.lat),
        Number(b.lng)
      )
    );
  }
  const routes = await Promise.all(legs);
  let merged = [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  let routedLegCount = 0;
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (route?.ok && Array.isArray(route.path) && route.path.length >= 2) {
      merged = appendWalkingPathSegment(merged, route.path);
      distanceMeters += Number(route.distanceMeters) || 0;
      durationSeconds += Number(route.durationSeconds) || 0;
      routedLegCount += 1;
      continue;
    }
    if (
      a &&
      b &&
      Number.isFinite(Number(a.lat)) &&
      Number.isFinite(Number(a.lng)) &&
      Number.isFinite(Number(b.lat)) &&
      Number.isFinite(Number(b.lng))
    ) {
      merged = appendWalkingPathSegment(merged, [
        { lat: Number(a.lat), lng: Number(a.lng) },
        { lat: Number(b.lat), lng: Number(b.lng) },
      ]);
    }
  }
  if (merged.length < 2) return null;
  return {
    ok: true,
    path: merged,
    distanceMeters,
    durationSeconds,
    routedLegCount,
    totalLegs: routes.length,
  };
}
