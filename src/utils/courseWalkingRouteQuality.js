/**
 * OSRM fallback 보행 경로 라벨 품질 판단(지도 폴리라인은 API 응답 그대로 사용).
 */

/** 직선 대비 라우트 길이 — 도심 블록·강변 우회에서 2.5~3.5배는 흔함 */
const DEFAULT_RATIO_MAX = 4.2;
/** m/s — OSRM duration이 지나치게 낙관적일 때만 라벨 '길 따라' 판단에서 제외 */
const MAX_PLAUSIBLE_AVG_SPEED_MPS = 6.5;
/** 너무 짧은 구간은 OSRM 노이즈 가능 — 그래도 실제 길 우선 */
const MIN_ROUTED_METERS = 28;

/**
 * @param {{ routedMeters: number, straightMeters: number | null, durationSeconds: number }} p
 */
export function isWalkingRouteReasonable(
  { routedMeters, straightMeters, durationSeconds },
  ratioMax = DEFAULT_RATIO_MAX
) {
  const r = Number(routedMeters);
  const s = Number(straightMeters);
  const ds = Number(durationSeconds);

  if (!Number.isFinite(r) || r < MIN_ROUTED_METERS) return false;

  if (Number.isFinite(s) && s >= 50) {
    const ratio = r / s;
    if (ratio > ratioMax) return false;
  }

  if (Number.isFinite(ds) && ds > 0) {
    const impliedSpeed = r / ds;
    if (impliedSpeed > MAX_PLAUSIBLE_AVG_SPEED_MPS) return false;
  }

  return true;
}

/** 라벨용 도보 분: API 분과 거리 기반 분 중 큰 값 (거리 0·duration만 있으면 duration만) */
export function walkingRouteDisplayMinutes(routedMeters, durationSeconds) {
  const r = Number(routedMeters) || 0;
  const ds = Number(durationSeconds) || 0;
  const fromDistance = r > 0 ? Math.max(1, Math.round(r / 70)) : 0;
  const fromDuration = ds > 0 ? Math.max(1, Math.round(ds / 60)) : 0;
  if (fromDistance > 0 && fromDuration > 0) {
    return Math.max(fromDistance, fromDuration);
  }
  if (fromDistance > 0) return fromDistance;
  if (fromDuration > 0) return fromDuration;
  return 1;
}

/** 도보 분 기준 — 이 이상이면 “좀 걷는다” 톤 */
const STROLL_HINT_WALK_MIN = 17;
/** 직선 대비 이 배율 이상이면 “살짝 돌아간다” 톤 (너무 짧은 구간은 제외) */
const STROLL_HINT_ROUTE_RATIO = 1.34;
const STROLL_HINT_MIN_STRAIGHT_M = 280;

/**
 * 코스 카드·시트에 넣는 한 줄 — 거리가 길거나 길 따라 우회가 클 때만(지도 오버레이에는 쓰지 않음).
 * @param {{ routedMeters: number, straightMeters: number | null, walkDisplayMinutes: number }} p
 * @returns {string}
 */
export function getCourseLongWalkStrollHint({
  routedMeters,
  straightMeters,
  walkDisplayMinutes,
}) {
  const dm = Number(routedMeters) || 0;
  const sm = Number(straightMeters);
  const wm = Number(walkDisplayMinutes);
  if (dm < 80) return "";

  let longish = Number.isFinite(wm) && wm >= STROLL_HINT_WALK_MIN;
  if (!longish && dm >= 1200) longish = true;

  let detour = false;
  if (Number.isFinite(sm) && sm >= STROLL_HINT_MIN_STRAIGHT_M && dm > 0) {
    detour = dm / sm >= STROLL_HINT_ROUTE_RATIO;
  }

  if (longish || detour) {
    return "배 좀 꺼뜨려야죠. 가볍게 산책해요";
  }
  return "";
}
