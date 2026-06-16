/** 홈(`/`) 진입 시 큐레이터 추천 장소 포커스 — `navigate("/", { state })` */
export const HOME_CURATOR_PLACE_FOCUS_STATE = "homeCuratorPlaceFocus";

/**
 * @param {{ curatorUserId?: string, placeId?: string, curatorChipKey?: string }} payload
 * @returns {Record<string, unknown> | null}
 */
export function buildHomeCuratorPlaceFocusState(payload) {
  const curatorUserId = String(payload?.curatorUserId ?? "").trim();
  const placeId = String(payload?.placeId ?? "").trim();
  const curatorChipKey = String(payload?.curatorChipKey ?? "").trim();
  if (!curatorUserId && !curatorChipKey) return null;
  return {
    [HOME_CURATOR_PLACE_FOCUS_STATE]: {
      ...(curatorUserId ? { curatorUserId } : {}),
      ...(placeId ? { placeId } : {}),
      ...(curatorChipKey ? { curatorChipKey } : {}),
    },
  };
}

/**
 * @param {unknown} locationState
 * @returns {{ curatorUserId: string, placeId: string, curatorChipKey: string } | null}
 */
export function readHomeCuratorPlaceFocusState(locationState) {
  const st =
    locationState && typeof locationState === "object" ? locationState : {};
  const raw = st[HOME_CURATOR_PLACE_FOCUS_STATE];
  if (!raw || typeof raw !== "object") return null;
  const curatorUserId = String(raw.curatorUserId ?? "").trim();
  const placeId = String(raw.placeId ?? "").trim();
  const curatorChipKey = String(raw.curatorChipKey ?? "").trim();
  if (!curatorUserId && !curatorChipKey) return null;
  return { curatorUserId, placeId, curatorChipKey };
}
