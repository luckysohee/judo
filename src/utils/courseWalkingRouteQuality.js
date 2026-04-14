/**
 * OSRM/OSM 보행 경로가 직선에 비해 과도하게 돌아가거나,
 * 거리 대비 duration이 비현실적이면(공개 데모·맵 구멍에서 흔함) 지도에는 쓰지 않는다.
 */

/** 직선 대비 라우트 길이 — 도심 블록·강변 우회에서 2.5~3.5배는 흔함 */
const DEFAULT_RATIO_MAX = 4.2;
/** m/s — OSRM duration이 낙관적일 때만 의심 (완만하게 완화) */
const MAX_PLAUSIBLE_AVG_SPEED_MPS = 3.4;
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

/** 라벨용 도보 분: API 분과 거리 기반 분 중 큰 값 */
export function walkingRouteDisplayMinutes(routedMeters, durationSeconds) {
  const r = Number(routedMeters) || 0;
  const ds = Number(durationSeconds) || 0;
  const fromDuration = ds > 0 ? Math.max(1, Math.round(ds / 60)) : 1;
  const fromDistance = Math.max(1, Math.round(r / 70));
  return Math.max(fromDuration, fromDistance);
}
