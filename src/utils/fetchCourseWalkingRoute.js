import { courseRouteLabelPosition } from "./courseDriveWaypoints";

// 비우면 Vite `/api` → server 프록시 (kakaoAPIProxy와 동일 규칙)
const API_BASE_URL = (
  import.meta.env.VITE_AI_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/$/, "");

/**
 * 1차→2차 보행 경로 폴리라인 (서버: 카카오 도보 우선 → OSRM fallback).
 * @returns {Promise<{ ok: true, path: {lat,lng}[], distanceMeters: number, durationSeconds: number, provider?: 'kakao'|'osrm' } | { ok: false, error?: string }>}
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
  /** @type {{ legIndex: number, path: {lat:number,lng:number}[], distanceMeters: number, durationSeconds: number, labelPosition: object|null, routed: boolean }[]} */
  const legResults = [];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const a = waypoints[i];
    const b = waypoints[i + 1];
    let legPath = [];
    let legDm = 0;
    let legDs = 0;
    let routed = false;

    if (route?.ok && Array.isArray(route.path) && route.path.length >= 2) {
      legPath = route.path.map((p) => ({
        lat: Number(p.lat),
        lng: Number(p.lng),
      }));
      legDm = Number(route.distanceMeters) || 0;
      legDs = Number(route.durationSeconds) || 0;
      merged = appendWalkingPathSegment(merged, legPath);
      distanceMeters += legDm;
      durationSeconds += legDs;
      routedLegCount += 1;
      routed = true;
    } else if (
      a &&
      b &&
      Number.isFinite(Number(a.lat)) &&
      Number.isFinite(Number(a.lng)) &&
      Number.isFinite(Number(b.lat)) &&
      Number.isFinite(Number(b.lng))
    ) {
      legPath = [
        { lat: Number(a.lat), lng: Number(a.lng) },
        { lat: Number(b.lat), lng: Number(b.lng) },
      ];
      merged = appendWalkingPathSegment(merged, legPath);
    }

    if (legPath.length >= 2) {
      legResults.push({
        legIndex: i,
        path: legPath,
        distanceMeters: legDm,
        durationSeconds: legDs,
        labelPosition: courseRouteLabelPosition(null, legPath, {
          perpendicularDeg: i % 2 === 0 ? 90 : -90,
        }),
        routed,
      });
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
    legs: legResults,
  };
}
