/** v2: 전국 이름검색 동명이인·전남광주 표기 오탐 밴 무효화 */
const STORAGE_KEY = "judo_geo_mismatch_place_ids_v2";

/**
 * 주소 공란·카카오 id 없음인데 서울 좌표만 있는 것으로 확인된 불량 행.
 * (노가리: 실주소 인천 옹진 영흥면 — bounds API에 address 비어 클라이언트 주소필터 불가)
 */
const KNOWN_EMPTY_ADDR_MISMATCH_IDS = [
  "6e8958ba-919b-4d14-b6bf-4787933bcd7c",
];

/**
 * 주소·좌표 불일치로 숨긴 place id (세션). 뷰포트 재로드해도 다시 안 뜨게.
 * @returns {Set<string>}
 */
export function readGeoMismatchPlaceIdSet() {
  const set = new Set(KNOWN_EMPTY_ADDR_MISMATCH_IDS);
  if (typeof window === "undefined") return set;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    for (const x of Array.isArray(arr) ? arr : []) {
      if (x != null && String(x)) set.add(String(x));
    }
  } catch {
    /* ignore */
  }
  return set;
}

/**
 * @param {string | number | null | undefined} placeId
 */
export function rememberGeoMismatchPlaceId(placeId) {
  if (placeId == null || placeId === "") return;
  const id = String(placeId);
  const set = readGeoMismatchPlaceIdSet();
  set.add(id);
  try {
    const known = new Set(KNOWN_EMPTY_ADDR_MISMATCH_IDS);
    const dynamic = [...set].filter((x) => !known.has(x));
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dynamic));
  } catch {
    /* ignore */
  }
}

/**
 * @param {object[]} places
 * @param {Set<string>} [idSet]
 * @returns {object[]}
 */
export function filterOutGeoMismatchPlaceIds(places, idSet) {
  const ban = idSet instanceof Set ? idSet : readGeoMismatchPlaceIdSet();
  if (!ban.size || !Array.isArray(places)) return places;
  return places.filter((p) => {
    const id = p?.id != null ? String(p.id) : "";
    return !id || !ban.has(id);
  });
}
