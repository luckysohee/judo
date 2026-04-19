/**
 * 행정구역 등 지역명 검색 시 OSM Nominatim 경계(서버 `/api/region-outline` 프록시).
 * @param {string} query 예: 부산, 서초구
 * @param {string} [apiBase] `VITE_AI_API_BASE_URL` — 비우면 동일 출처 `/api`
 */
export async function fetchRegionOutline(query, apiBase = "") {
  const q = String(query || "").trim();
  if (!q) return { ok: false, error: "empty_query" };
  const base = String(apiBase || "").replace(/\/$/, "");
  const qs = new URLSearchParams({ query: q });
  const url = base
    ? `${base}/api/region-outline?${qs.toString()}`
    : `/api/region-outline?${qs.toString()}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || `http_${res.status}` };
  }
  return data;
}
