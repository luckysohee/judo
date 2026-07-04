/**
 * `places` bbox 조회 최소 행 → 지도·리스트용 객체 (큐레이터 메타 없음)
 */
export function formatBoundsPlaceRowsForMap(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((p) => ({
    id: p.id,
    name: p.name ?? "",
    lat: p.lat,
    lng: p.lng,
    x: p.lng != null ? String(p.lng) : undefined,
    y: p.lat != null ? String(p.lat) : undefined,
    category: (p.category && String(p.category).trim()) || "미분류",
    category_name: (p.category_name && String(p.category_name).trim()) || "",
    phone: p.phone || "",
    // RPC/bbox 행은 address 를 내려줌 — 버리지 말고 통과(미보유 시 도로명·지번 폴백)
    address: p.address || p.road_address_name || p.address_name || "",
    address_name: p.address_name || "",
    road_address_name: p.road_address_name || "",
    place_url: "",
    place_id: null,
    kakao_place_id: null,
    kakaoId: null,
    isKakaoPlace: false,
    curatorCount: 0,
    curators: [],
    curatorUsernames: [],
    curatorReasons: {},
    curatorPlaces: [],
    comment: "",
    savedCount: 0,
    tags: [],
    moods: [],
    vibes: [],
    is_public: true,
  }));
}
