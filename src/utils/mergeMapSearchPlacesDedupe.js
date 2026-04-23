/**
 * 지도 검색: 통합 API 결과 + 카카오 JS SDK 키워드 검색 결과를 합칠 때 쓰는 안정 키.
 * `kakao_place_id`가 있으면 우선(네이버·카카오 REST·SDK 동일 장소 병합).
 */
export function mapPlaceStableDedupeKey(place) {
  if (!place || typeof place !== "object") return "";
  const kPid =
    place.kakao_place_id != null && String(place.kakao_place_id).trim();
  if (kPid) return `k:${kPid}`;
  const id = place.id != null && String(place.id).trim();
  if (id) return `i:${id}`;
  const nm = String(place.place_name || place.name || "").trim();
  const y = parseFloat(place.y ?? place.lat);
  const x = parseFloat(place.x ?? place.lng);
  if (nm && Number.isFinite(y) && Number.isFinite(x)) {
    return `g:${nm}:${y.toFixed(5)}:${x.toFixed(5)}`;
  }
  return "";
}

/**
 * `first` 순서를 유지한 뒤 `second`에서 새 키만 이어 붙인다.
 */
export function mergeMapSearchPlacesDedupe(first, second) {
  const out = [];
  const seen = new Set();
  for (const list of [first, second]) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const key = mapPlaceStableDedupeKey(p);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(p);
    }
  }
  return out;
}
