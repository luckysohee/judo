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

/**
 * 코스 카드 헤더 한 줄 — `정석 코스(식사부터 2차까지…)` 형태로 통일.
 * @param {number} [index] — 제목·부제가 모두 비었을 때 `코스 n` 폴백용 (스와이프 인덱스)
 */
export function formatCourseProfileOneLine(course, index = 0) {
  const title = String(course?.profileTitle ?? "").trim();
  const desc = String(course?.profileDescription ?? "").trim();
  const fallback =
    Number.isFinite(index) && index >= 0 ? `코스 ${index + 1}` : "코스";
  if (title && desc) return `${title}(${desc})`;
  if (title) return title;
  if (desc) return desc;
  return fallback;
}

function sumWalkLegsFromSteps(steps) {
  if (!Array.isArray(steps) || steps.length < 2) return null;
  let sum = 0;
  let any = false;
  for (let i = 1; i < steps.length; i++) {
    const w = Number(steps[i]?.walkDistanceMeters);
    if (Number.isFinite(w) && w > 0) {
      sum += w;
      any = true;
    }
  }
  return any ? sum : null;
}

function sumHaversineLegsFromSteps(steps) {
  if (!Array.isArray(steps) || steps.length < 2) return null;
  let total = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    const a = resolvePlaceWgs84(steps[i]?.place);
    const b = resolvePlaceWgs84(steps[i + 1]?.place);
    if (!a || !b) continue;
    const d = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    if (Number.isFinite(d) && d > 0) total += d;
  }
  return total > 0 ? Math.round(total) : null;
}

/** 구간별 도보 거리(m) 중 최댓값 — 힌트·부담감 판단용 */
export function getCourseMaxLegMeters(course) {
  const steps = course?.steps || [];
  if (steps.length < 2) return null;
  let max = 0;
  let any = false;
  for (let i = 1; i < steps.length; i++) {
    const w = Number(steps[i]?.walkDistanceMeters);
    if (Number.isFinite(w) && w > 0) {
      any = true;
      if (w > max) max = w;
    }
  }
  if (any && max > 0) return max;
  for (let i = 0; i < steps.length - 1; i++) {
    const a = resolvePlaceWgs84(steps[i]?.place);
    const b = resolvePlaceWgs84(steps[i + 1]?.place);
    if (!a || !b) continue;
    const d = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    if (Number.isFinite(d) && d > 0 && d > max) max = d;
  }
  return max > 0 ? Math.round(max) : null;
}

/**
 * 1차→2차 한 구간, 또는 쩜오 포함 3단계일 때 **구간 walk 합산**(1→쩜오 + 쩜오→2).
 * 직선·도보 거리(m): 엔진 `walkDistanceMeters` 우선.
 */
export function getCourseLegMeters(course) {
  const steps = course?.steps || [];
  if (steps.length >= 3) {
    const fromWalk = sumWalkLegsFromSteps(steps);
    if (fromWalk != null && fromWalk > 0) return fromWalk;
    return sumHaversineLegsFromSteps(steps);
  }
  const w = Number(course?.steps?.[1]?.walkDistanceMeters);
  if (Number.isFinite(w) && w > 0) return w;
  const a = resolvePlaceWgs84(course?.steps?.[0]?.place);
  const b = resolvePlaceWgs84(course?.steps?.[1]?.place);
  if (!a || !b) return null;
  const d = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  return Number.isFinite(d) && d > 0 ? d : null;
}

/** 바텀시트·피크 한 줄: 대략 거리 + 도보 분 (지도는 카카오 도보 경로, 미승인 시 OSRM) */
export function formatCourseLegDistanceSummary(course) {
  const m = getCourseLegMeters(course);
  if (m == null) return "";
  const dist =
    m >= 1000 ? `약 ${(m / 1000).toFixed(1)}km` : `약 ${Math.round(m)}m`;
  const walk = formatCourseWalkApprox(m);
  const prefix = (course?.steps?.length ?? 0) >= 3 ? "총 동선 " : "";
  if (dist && walk) return `${prefix}${dist} · ${walk}`;
  return prefix ? `${prefix}${dist || walk}` : dist || walk;
}

function formatMetersBrief(m) {
  const x = Number(m);
  if (!Number.isFinite(x) || x <= 0) return null;
  return x >= 1000
    ? `약 ${(x / 1000).toFixed(1)}km`
    : `약 ${Math.round(x)}m`;
}

/** `steps[i]`에 붙은 도보 구간 = 이전 스텝 장소 → `steps[i]` 장소 */
function metersForWalkIntoStep(steps, intoIndex) {
  if (!Array.isArray(steps) || intoIndex < 1) return null;
  const w = Number(steps[intoIndex]?.walkDistanceMeters);
  if (Number.isFinite(w) && w > 0) return w;
  const a = resolvePlaceWgs84(steps[intoIndex - 1]?.place);
  const b = resolvePlaceWgs84(steps[intoIndex]?.place);
  if (!a || !b) return null;
  const d = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  return Number.isFinite(d) && d > 0 ? d : null;
}

/**
 * 쩜오 포함 3단계: 구간별 거리·대략 도보 분 + (두 구간 모두 있을 때만) 합산 한 줄.
 * @returns {{ lines: string[], totalLine: string } | null}
 */
export function formatCourseThreeStepWalkingSummary(course) {
  const steps = course?.steps || [];
  if (steps.length < 3) return null;

  const stepLabel = (i, fallback) => {
    const t = String(steps[i]?.label || "").trim();
    return t || fallback;
  };
  const l0 = stepLabel(0, "1차");
  const l1 = stepLabel(1, "쩜오차");
  const l2 = stepLabel(2, "2차");

  const m1 = metersForWalkIntoStep(steps, 1);
  const m2 = metersForWalkIntoStep(steps, 2);

  const lines = [];
  if (m1 != null) {
    const dist = formatMetersBrief(m1);
    const walk = formatCourseWalkApprox(m1);
    if (dist && walk) lines.push(`${l0}→${l1} ${dist} · ${walk}`);
  }
  if (m2 != null) {
    const dist = formatMetersBrief(m2);
    const walk = formatCourseWalkApprox(m2);
    if (dist && walk) lines.push(`${l1}→${l2} ${dist} · ${walk}`);
  }
  if (!lines.length) return null;

  let totalLine = "";
  if (m1 != null && m2 != null) {
    const total = m1 + m2;
    const dist = formatMetersBrief(total);
    const walk = formatCourseWalkApprox(total);
    if (dist && walk) totalLine = `도보 합산 ${dist} · ${walk}`;
  }

  return { lines, totalLine };
}

/**
 * 대략 거리 기준 가벼운 안내 (카드 한 줄용)
 */
export function getCourseWalkComfortHint(distanceMeters, opts = {}) {
  const m = Number(distanceMeters);
  if (!Number.isFinite(m) || m <= 0) return "";
  const legLabel = opts.multiLeg ? "다음 구간" : "2차까지";
  if (m < 700) return "";
  if (m < 1100) return `${legLabel} 조금 걸어요`;
  if (m < 1600) return `${legLabel} 걷기엔 꽤 걸려요`;
  return `${legLabel} 걷기엔 꽤 멀어요`;
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

  if (course.steps.length >= 3) {
    const mid = course.steps[1];
    const last = course.steps[2];
    if (!mid?.place?.name || !last?.place?.name) return "";
    const w1 = Math.max(1, Math.round((mid.walkDistanceMeters || 0) / 70));
    const w2 = Math.max(1, Math.round((last.walkDistanceMeters || 0) / 70));
    return `${first.place.name}에서 1차로 머문 뒤, 도보 약 ${w1}분 거리의 ${mid.place.name}(쩜오차)를 거쳐 약 ${w2}분 걸어 ${last.place.name}로 2차까지 이어가기 좋은 코스예요.`;
  }

  const walkM = Math.max(1, Math.round((second.walkDistanceMeters || 0) / 70));
  return `${first.place.name}에서 약 ${first.stayMinutes}분 1차로 머물고, 도보 ${walkM}분 안쪽의 ${second.place.name}로 2차 이어가기 좋은 코스예요.`;
}
