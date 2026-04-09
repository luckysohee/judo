/**
 * 카카오 Places.keywordSearch 행 → MapView / 미리보기 카드용 객체
 * @param {object[]} data - 카카오 API documents
 * @returns {object[]}
 */
export function formatKakaoKeywordHitsForMap(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const place of data) {
    if (!place) continue;
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      id: `kakao_${place.id}`,
      name: place.place_name,
      place_name: place.place_name,
      lat,
      lng,
      x: place.x,
      y: place.y,
      address: place.road_address_name || place.address_name,
      road_address_name: place.road_address_name,
      address_name: place.address_name,
      category_name: place.category_name,
      phone: place.phone || "",
      kakao_place_id: place.id,
      place_url: place.place_url || "",
      isKakaoPlace: true,
      /** 타이핑 자동완성 후보 — 클러스터 제외·전국 좌표 허용 */
      isKakaoTypingPreview: true,
      distance: place.distance,
    });
  }
  return out;
}
