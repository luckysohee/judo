/**
 * 메인 지도 검색용: 네이버 지역 + 카카오 키워드 병합 + (선택) 블로그 크롤 한 번에.
 * 서버 `POST /api/unified-map-search`
 */
import { getApiAuthHeaders } from "./apiAuthHeaders.js";

export async function fetchUnifiedMapSearch(
  {
    query,
    searchPhrases,
    includeBlog = true,
    blogTimeoutMs = 14000,
  },
  apiBase = ""
) {
  const base = String(apiBase || "").replace(/\/$/, "");
  const url = base ? `${base}/api/unified-map-search` : "/api/unified-map-search";
  const res = await fetch(url, {
    method: "POST",
    headers: await getApiAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      query,
      searchPhrases,
      includeBlog,
      blogTimeoutMs,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "unified-map-search failed");
  }
  return data;
}
