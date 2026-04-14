import { haversineMeters, resolvePlaceWgs84 } from "./placeCoords.js";
import { getMinutesUntilClose, isPlaceOpenNow } from "./timeUtils.js";

/** 체류 시간 표시 (코스 카드 등) */
export function formatCourseStayMinutes(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return "";
  const hours = Math.floor(m / 60);
  const remain = Math.round(m % 60);
  if (hours > 0 && remain > 0) return `${hours}시간 ${remain}분`;
  if (hours > 0) return `${hours}시간`;
  return `${remain}분`;
}

/** 거리(m) → 대략 도보 분 (보행 70m/분 가정) */
export function formatCourseWalkApprox(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return "";
  const minutes = Math.max(1, Math.round(distanceMeters / 70));
  return `도보 약 ${minutes}분`;
}

/** 1차→2차 구간 거리(m): 엔진 값 우선, 없으면 좌표로 직선 거리 */
export function getCourseLegMeters(course) {
  const w = Number(course?.steps?.[1]?.walkDistanceMeters);
  if (Number.isFinite(w) && w > 0) return w;
  const a = resolvePlaceWgs84(course?.steps?.[0]?.place);
  const b = resolvePlaceWgs84(course?.steps?.[1]?.place);
  if (!a || !b) return null;
  const d = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  return Number.isFinite(d) && d > 0 ? d : null;
}

/** 바텀시트·피크 한 줄: 대략 거리 + 도보 분 (지도는 OSRM 보행 경로로 표시) */
export function formatCourseLegDistanceSummary(course) {
  const m = getCourseLegMeters(course);
  if (m == null) return "";
  const dist =
    m >= 1000 ? `약 ${(m / 1000).toFixed(1)}km` : `약 ${Math.round(m)}m`;
  const walk = formatCourseWalkApprox(m);
  if (dist && walk) return `${dist} · ${walk}`;
  return dist || walk;
}

/**
 * 대략 거리 기준 가벼운 안내 (카드 한 줄용)
 */
export function getCourseWalkComfortHint(distanceMeters) {
  const m = Number(distanceMeters);
  if (!Number.isFinite(m) || m <= 0) return "";
  if (m < 700) return "";
  if (m < 1100) return "2차까지 조금 걸어요";
  if (m < 1600) return "2차까지 걷기엔 꽤 걸려요";
  return "2차까지 걷기엔 꽤 멀어요";
}

/** 카드에 붙이는 영업 한 줄 */
export function getCourseOpenStatusText(place) {
  if (!place) return "";
  const openNow = isPlaceOpenNow(place);
  const minutesUntilClose = getMinutesUntilClose(place);

  if (openNow === true) {
    if (minutesUntilClose != null && minutesUntilClose < 60) {
      return `곧 마감 · 약 ${minutesUntilClose}분 남음`;
    }
    return "영업중";
  }

  if (openNow === false) {
    return "영업종료(참고)";
  }

  return "";
}

/** AI 없이 한 줄 설명 (리스트·공유용) */
export function buildCourseDescription(course) {
  if (!course?.steps?.length) return "";
  const first = course.steps[0];
  const second = course.steps[1];
  if (!first?.place?.name || !second?.place?.name) return "";

  const walkM = Math.max(1, Math.round((second.walkDistanceMeters || 0) / 70));
  return `${first.place.name}에서 약 ${first.stayMinutes}분 1차로 머물고, 도보 ${walkM}분 안쪽의 ${second.place.name}로 2차 이어가기 좋은 코스예요.`;
}
