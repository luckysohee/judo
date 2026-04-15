/**
 * DB·.env 정책: curator_places.curator_id 가 curators.user_id 인지 id 인지.
 * Vite 클라이언트는 vite.config 의 define 으로
 * import.meta.env.VITE_CURATOR_PLACES_CURATOR_ID_MODE 가 채워짐(루트 .env 의 CURATOR_PLACES_CURATOR_ID_MODE 와 동일 값).
 */
export function getCuratorPlacesCuratorIdMode() {
  return String(
    import.meta.env.VITE_CURATOR_PLACES_CURATOR_ID_MODE || "both"
  )
    .toLowerCase()
    .trim();
}

/**
 * 로그인 큐레이터 본인의 curator_places 행인지 (curator_id vs user_id / PK).
 */
export function curatorPlaceMatchesLoggedInCurator(cp, curatorProfile, userId) {
  const mode = getCuratorPlacesCuratorIdMode();
  const cid = String(cp?.curator_id ?? "").trim();
  if (!cid) return false;

  const authUid = String(userId ?? "").trim();
  const pk = String(curatorProfile?.id ?? "").trim();
  const rowUserId = String(curatorProfile?.user_id ?? "").trim();

  if (mode === "user_id" || mode === "userid") {
    if (authUid && cid === authUid) return true;
    if (rowUserId && cid === rowUserId) return true;
    return false;
  }
  if (mode === "id" || mode === "pk") {
    return pk ? cid === pk : false;
  }
  if (authUid && cid === authUid) return true;
  if (rowUserId && cid === rowUserId) return true;
  if (pk && cid === pk) return true;
  return false;
}
