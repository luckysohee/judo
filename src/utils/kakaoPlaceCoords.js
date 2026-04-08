/**
 * 카카오 로컬 키워드 검색으로 place id에 해당하는 WGS84 좌표 조회.
 * DB/병합 객체에 lat·lng가 비어 있을 때 체크인·지도 보정용.
 */
export async function fetchKakaoCoordsByPlaceId({
  kakaoPlaceId,
  name,
  address,
}) {
  const key = import.meta.env.VITE_KAKAO_REST_API_KEY;
  const idStr = kakaoPlaceId != null ? String(kakaoPlaceId).trim() : "";
  if (!key || !idStr || !/^\d+$/.test(idStr)) return null;

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
      const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      url.searchParams.set("query", query);
      url.searchParams.set("size", "15");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${key}` },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const docs = Array.isArray(data.documents) ? data.documents : [];
      const hit = docs.find((d) => String(d.id) === idStr);
      if (!hit) continue;
      const lat = parseFloat(hit.y);
      const lng = parseFloat(hit.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return { lat, lng };
    } catch {
      /* 다음 쿼리 시도 */
    }
  }
  return null;
}
