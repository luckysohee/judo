/**
 * user_saved_places + places 조인 행 → SavedPlaces 시트용 장소 카드.
 * @param {object} row
 */
export function mapSavedPlaceRowForFolderSheet(row) {
  if (!row || typeof row !== "object") return null;
  const p = row.places && typeof row.places === "object" ? row.places : {};
  const id = String(p.id || row.place_id || "").trim();
  if (!id) return null;
  const name = String(p.name || p.place_name || row.place_name || "").trim();
  const address = String(p.address || p.road_address_name || "").trim();
  const image = String(
    p.image_url || p.image || p.thumbnail_url || ""
  ).trim();
  return {
    id,
    name: name || "이름 없음",
    image: image || "",
    region: address,
    address,
    comment: "",
    savedCount: "",
    lat: p.lat ?? p.y ?? null,
    lng: p.lng ?? p.x ?? null,
    kakao_place_id: p.kakao_place_id || null,
  };
}

export const SAVED_FOLDER_SHEET_FALLBACKS = [
  { key: "after_party", name: "2차", color: "#FF8C42", icon: "🍺", sort_order: 1 },
  { key: "date", name: "데이트", color: "#FF69B4", icon: "💘", sort_order: 2 },
  { key: "hangover", name: "해장", color: "#87CEEB", icon: "🥣", sort_order: 3 },
  { key: "solo", name: "혼술", color: "#9B59B6", icon: "👤", sort_order: 4 },
  { key: "group", name: "회식", color: "#F1C40F", icon: "👥", sort_order: 5 },
  { key: "must_go", name: "찐맛집", color: "#27AE60", icon: "🌟", sort_order: 6 },
  { key: "terrace", name: "야외/뷰", color: "#5DADE2", icon: "🌅", sort_order: 7 },
];
