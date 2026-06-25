import { searchKakaoKeywordViaProxy } from "./kakaoAPIProxy.js";

const kakaoCoordsCache = new Map();
const KAKAO_COORDS_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * 카카오 로컬 키워드 검색으로 place id에 해당하는 WGS84 좌표 조회.
 * DB/병합 객체에 lat·lng가 비어 있을 때 체크인·지도 보정용.
 */
export async function fetchKakaoCoordsByPlaceId({
  kakaoPlaceId,
  name,
  address,
  bypassCache = false,
}) {
  const idStr = kakaoPlaceId != null ? String(kakaoPlaceId).trim() : "";
  if (!idStr || !/^\d+$/.test(idStr)) return null;

  if (!bypassCache) {
    const hit = kakaoCoordsCache.get(idStr);
    if (hit && Date.now() - hit.ts < KAKAO_COORDS_CACHE_TTL_MS) {
      return hit.coords;
    }
  }

  const queries = [];
  const n = typeof name === "string" ? name.trim() : "";
  const a = typeof address === "string" ? address.trim() : "";
  if (n && a) queries.push(`${n} ${a}`.slice(0, 100));
  if (n) queries.push(n.slice(0, 100));
  if (a) queries.push(a.slice(0, 100));
  const uniq = [...new Set(queries.filter(Boolean))];
  if (uniq.length === 0) return null;

  for (const query of uniq) {
    try {
      const { documents: docs } = await searchKakaoKeywordViaProxy({
        query,
        size: 15,
      });
      const hit = docs.find((d) => String(d.id) === idStr);
      if (!hit) continue;
      const lat = parseFloat(hit.y);
      const lng = parseFloat(hit.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const coords = { lat, lng };
      kakaoCoordsCache.set(idStr, { ts: Date.now(), coords });
      return coords;
    } catch {
      /* 다음 쿼리 시도 */
    }
  }
  return null;
}
