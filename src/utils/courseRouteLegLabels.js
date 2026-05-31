import { haversineMeters } from "./placeCoords";
import { courseRouteLabelPosition } from "./courseDriveWaypoints";
import {
  isWalkingRouteReasonable,
  walkingRouteDisplayMinutes,
} from "./courseWalkingRouteQuality";

/**
 * @param {object} drive
 * @returns {string[]}
 */
export function stepLabelsFromCourseDrive(drive) {
  const steps = Array.isArray(drive?.steps) ? drive.steps : [];
  return steps.map((s, i) => {
    const t = String(s?.label || "").trim();
    return t || `${i + 1}차`;
  });
}

function formatDist(meters) {
  const m = Number(meters) || 0;
  if (m <= 0) return "";
  return m >= 1000 ? `약 ${(m / 1000).toFixed(1)}km` : `약 ${Math.round(m)}m`;
}

/**
 * @param {string} fromLabel
 * @param {string} toLabel
 * @param {number} routedMeters
 * @param {number} durationSeconds
 * @param {number|null} straightMeters
 */
export function buildCourseWalkingLegLabel(
  fromLabel,
  toLabel,
  routedMeters,
  durationSeconds,
  straightMeters = null
) {
  const from = String(fromLabel || "").trim() || "출발";
  const to = String(toLabel || "").trim() || "도착";
  const dm = Number(routedMeters) || 0;
  const sm = Number(straightMeters);
  const effectiveM =
    dm > 0 ? dm : Number.isFinite(sm) && sm > 0 ? sm : 0;
  if (effectiveM <= 0) {
    return `${from}→${to}`;
  }
  const walkMin = walkingRouteDisplayMinutes(effectiveM, durationSeconds);
  const distStr = formatDist(effectiveM);
  const reasonable =
    dm > 0 &&
    isWalkingRouteReasonable({
      routedMeters: dm,
      straightMeters: Number.isFinite(sm) ? sm : null,
      durationSeconds,
    });
  if (reasonable && distStr) {
    return `${from}→${to} · 길 따라 ${distStr} · 도보 약 ${walkMin}분`;
  }
  if (distStr) {
    return `${from}→${to} · ${distStr} · 도보 약 ${walkMin}분`;
  }
  return `${from}→${to} · 도보 약 ${walkMin}분`;
}

/**
 * @param {{ lat: number, lng: number }[]} waypoints
 * @param {string[]} stepLabels
 * @returns {{ legLabel: string, labelPosition: { lat: number, lng: number } | null }[]}
 */
export function buildStraightCourseLegLabels(waypoints, stepLabels) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return [];
  const out = [];
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
      continue;
    }
    const path = [
      { lat: Number(a.lat), lng: Number(a.lng) },
      { lat: Number(b.lat), lng: Number(b.lng) },
    ];
    const straightM = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    const estSec = Math.max(60, Math.round(straightM / 1.2));
    out.push({
      legLabel: buildCourseWalkingLegLabel(
        stepLabels[i],
        stepLabels[i + 1],
        straightM,
        estSec,
        straightM
      ),
      labelPosition: courseRouteLabelPosition(null, path, {
        perpendicularDeg: i % 2 === 0 ? 90 : -90,
      }),
    });
  }
  return out;
}

/**
 * @param {object} route `fetchChainedCourseWalkingRoutes` 결과
 * @param {{ lat: number, lng: number }[]} waypoints
 * @param {string[]} stepLabels
 */
function appendPathSegment(basePath, nextSegment) {
  if (!Array.isArray(nextSegment) || nextSegment.length === 0) return basePath;
  const seg = nextSegment
    .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
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
 * @param {object} drive
 * @returns {string}
 */
function stepPlaceIdFromDrive(drive, stepIndex) {
  const st = drive?.steps?.[stepIndex];
  const p = st?.place;
  return String(p?.id || "").trim();
}

/**
 * 도장 찍은 차수를 **출발**로 하는 구간(예: 1차→2차)은 지도에서 제거 — 남은 leg만 표시.
 * 1차 도장 후에는 2차→3차… 구간만 남음.
 * @param {object} drive
 * @param {Set<string>|string[]} stampedPlaceIds
 * @returns {number[]}
 */
export function remainingCourseLegIndices(drive, stampedPlaceIds) {
  const stamped =
    stampedPlaceIds instanceof Set
      ? stampedPlaceIds
      : new Set(stampedPlaceIds || []);
  const steps = Array.isArray(drive?.steps) ? drive.steps : [];
  const legCount = Math.max(0, steps.length - 1);
  if (legCount === 0) return [];
  if (stamped.size === 0) {
    return Array.from({ length: legCount }, (_, i) => i);
  }
  const out = [];
  for (let i = 0; i < legCount; i++) {
    const fromId = stepPlaceIdFromDrive(drive, i);
    if (fromId && stamped.has(fromId)) continue;
    out.push(i);
  }
  return out;
}

/**
 * @param {object} drive
 * @param {{ path?: {lat,lng}[], legLabels?: object[], route?: object|null, waypoints?: object[], stepLabels?: string[] }} input
 * @param {Set<string>|string[]} stampedPlaceIds
 * @returns {{ path: {lat:number,lng:number}[]|null, legLabels: object[] }}
 */
export function filterCourseRouteOverlayForStamps(
  drive,
  input,
  stampedPlaceIds
) {
  const indices = remainingCourseLegIndices(drive, stampedPlaceIds);
  const allLabels = Array.isArray(input?.legLabels) ? input.legLabels : [];
  const waypoints = Array.isArray(input?.waypoints) ? input.waypoints : [];
  const stepLabels = Array.isArray(input?.stepLabels) ? input.stepLabels : [];
  const route = input?.route;

  const legLabels = indices
    .map((i) => allLabels[i])
    .filter((e) => e && String(e.legLabel || "").trim());

  let path = [];
  const routeLegs = Array.isArray(route?.legs) ? route.legs : [];
  if (routeLegs.length > 0) {
    for (const i of indices) {
      const leg = routeLegs[i];
      if (leg?.path?.length >= 2) {
        path = appendPathSegment(path, leg.path);
      }
    }
  } else if (waypoints.length >= 2) {
    for (const i of indices) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      if (!a || !b) continue;
      path = appendPathSegment(path, [
        { lat: Number(a.lat), lng: Number(a.lng) },
        { lat: Number(b.lat), lng: Number(b.lng) },
      ]);
    }
  } else if (Array.isArray(input?.path) && input.path.length >= 2) {
    path = indices.length > 0 ? input.path : [];
  }

  return {
    path: path.length >= 2 ? path : null,
    legLabels,
  };
}

export function buildRoutedCourseLegLabels(route, waypoints, stepLabels) {
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  if (legs.length === 0) {
    return buildStraightCourseLegLabels(waypoints, stepLabels);
  }
  return legs.map((leg, i) => {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const straightM =
      a && b
        ? haversineMeters(
            Number(a.lat),
            Number(a.lng),
            Number(b.lat),
            Number(b.lng)
          )
        : null;
    const path =
      Array.isArray(leg.path) && leg.path.length >= 2
        ? leg.path
        : a && b
          ? [
              { lat: Number(a.lat), lng: Number(a.lng) },
              { lat: Number(b.lat), lng: Number(b.lng) },
            ]
          : [];
    return {
      legLabel: buildCourseWalkingLegLabel(
        stepLabels[i],
        stepLabels[i + 1],
        leg.distanceMeters,
        leg.durationSeconds,
        straightM
      ),
      labelPosition:
        leg.labelPosition ||
        courseRouteLabelPosition(null, path, {
          perpendicularDeg: i % 2 === 0 ? 90 : -90,
        }),
    };
  });
}
