import { haversineMeters } from "./placeCoords.js";
import { formatCourseWalkApprox } from "./formatCourseUi.js";

/**
 * 선택된 코스 → 지도 폴리라인·마커 메타
 * @param {object} course generateCourseOptions 한 항목
 */
export function buildCourseMapData(course) {
  if (!course?.steps?.length) return null;

  const markers = course.steps.map((step) => ({
    id: step.place?.id,
    step: step.step,
    label: step.label,
    name: step.place?.name,
    lat: Number(step.place?.lat),
    lng: Number(step.place?.lng),
  }));

  const polylinePath = markers
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
    .map((m) => ({ lat: m.lat, lng: m.lng }));

  if (polylinePath.length < 2) return null;

  const a = polylinePath[0];
  const b = polylinePath[polylinePath.length - 1];
  let meters = Number(course.steps[1]?.walkDistanceMeters);
  if (!Number.isFinite(meters) || meters <= 0) {
    meters = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  }

  const dist =
    meters >= 1000
      ? `약 ${(meters / 1000).toFixed(1)}km`
      : `약 ${Math.round(meters)}m`;
  const walk = formatCourseWalkApprox(meters);
  const legLabel = dist && walk ? `${dist} · ${walk}` : dist || walk || "";

  const labelPosition = {
    lat: (a.lat + b.lat) / 2,
    lng: (a.lng + b.lng) / 2,
  };

  return { markers, polylinePath, legLabel, labelPosition };
}
