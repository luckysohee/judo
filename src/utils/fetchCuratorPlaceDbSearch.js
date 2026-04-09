/**
 * 서버 `/api/search/curator-places` 호출 — pg_trgm / pgvector 하이브리드.
 * @param {string} baseUrl VITE_AI_API_BASE_URL (끝 슬래시 없음)
 */
export async function fetchCuratorPlaceDbSearch(baseUrl, body) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  if (!root) {
    return { ok: false, rows: [], mode: "no_base_url" };
  }
  try {
    const res = await fetch(`${root}/api/search/curator-places`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        rows: [],
        mode: json.mode || "http_error",
        error: json.error || res.statusText,
      };
    }
    return {
      ok: true,
      rows: Array.isArray(json.rows) ? json.rows : [],
      mode: json.mode || "unknown",
    };
  } catch {
    return { ok: false, rows: [], mode: "network_error" };
  }
}

/** DB에 있는 place UUID를 카카오 등 외부 id보다 앞에 둠 */
export function mergeDbPlaceIdsFirst(dbRows, externalIds) {
  const fromDb = (dbRows || [])
    .map((r) => r.place_id ?? r.placeId)
    .filter(Boolean)
    .map((id) => String(id));
  const seen = new Set();
  const out = [];
  for (const id of fromDb) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of externalIds || []) {
    const s = String(id);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(id);
  }
  return out;
}
