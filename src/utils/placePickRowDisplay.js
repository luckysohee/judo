/**
 * `place_picks` + `places` 조인 행 표시용. `curator_places` 와 역할을 섞지 않는다.
 */

/**
 * @param {object} row — `fetchUserPickedPlaces` 한 행 (`places` FK)
 * @returns {{ name: string, address: string, isCuratorPick: boolean, place: object|null, placeId: string|null }}
 */
export function pickRowDisplay(row) {
  const p = row?.places;
  const name = String(p?.name ?? "").trim() || "이름 없음";
  const address = String(
    p?.address ?? p?.road_address ?? p?.road_address_name ?? ""
  ).trim();
  const placeId =
    (p && typeof p.id === "string" && p.id) || row?.place_id || null;
  return {
    name,
    address,
    isCuratorPick: Boolean(row?.is_curator),
    place: p && typeof p === "object" ? p : null,
    placeId,
  };
}

/**
 * `PlaceDetail` 등 지도·상세에 넘길 최소 셰이프 (DB `places` 기준).
 * @param {object} row
 * @returns {object|null}
 */
export function placePickJoinRowToDetailPlace(row) {
  const p = row?.places;
  if (!p || typeof p !== "object") return null;
  const id = p.id ?? row?.place_id;
  if (!id) return null;
  return {
    id,
    name: p.name ?? "이름 없음",
    address: p.address ?? p.road_address ?? "",
    region: p.region ?? "",
    image: p.image_url ?? p.image ?? "",
    comment: "",
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    primaryCurator: "",
    curators: [],
    savedCount: 0,
  };
}
