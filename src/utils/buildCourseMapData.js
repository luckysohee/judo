import { haversineMeters } from "./placeCoords.js";
import {
  formatCourseWalkApprox,
  getCourseLegMeters,
} from "./formatCourseUi.js";

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

  const meters = getCourseLegMeters(course);
  const m =
    meters != null && Number.isFinite(meters) && meters > 0
      ? meters
      : haversineMeters(
          polylinePath[0].lat,
          polylinePath[0].lng,
          polylinePath[polylinePath.length - 1].lat,
          polylinePath[polylinePath.length - 1].lng
        );

  const dist =
    m >= 1000 ? `약 ${(m / 1000).toFixed(1)}km` : `약 ${Math.round(m)}m`;
  const walk = formatCourseWalkApprox(m);
  const totalPrefix = (course.steps?.length ?? 0) >= 3 ? "총 " : "";
  const legLabel =
    dist && walk
      ? `${totalPrefix}${dist} · ${walk}`
      : `${totalPrefix}${dist || walk || ""}`.trim() || "";

  const midIdx = Math.floor(polylinePath.length / 2);
  const mid = polylinePath[midIdx] || polylinePath[0];
  const labelPosition = { lat: mid.lat, lng: mid.lng };

  return { markers, polylinePath, legLabel, labelPosition };
}
