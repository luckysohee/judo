import { normalizeApiBaseUrl } from "../utils/apiBaseUrl.js";

/**
 * 홈 지도 뷰포트 — 서버 `GET /api/places-in-bounds` (Supabase service role + `get_places_in_bounds` RPC).
 * 프론트에서 `places` / `curator_places` 직접 select 하지 않음.
 *
 * @param {{ south: number, west: number, north: number, east: number, limit?: number }} bounds
 * @param {string} [apiBaseUrl] 프로덕션 등 `VITE_AI_API_BASE_URL` (끝 슬래시 없음). 비우면 상대 `/api/...` (Vite 프록시).
 */
export async function fetchMapPlacesInBounds(bounds, apiBaseUrl = "") {
  const { south, west, north, east, limit = 80 } = bounds || {};
  if (![south, west, north, east].every((n) => Number.isFinite(Number(n)))) {
    throw new Error("fetchMapPlacesInBounds: south, west, north, east required");
  }
  const lim = Math.min(120, Math.max(1, Math.floor(Number(limit) || 80)));
  const qs = new URLSearchParams({
    south: String(south),
    west: String(west),
    north: String(north),
    east: String(east),
    limit: String(lim),
  });
  const path = `/api/places-in-bounds?${qs.toString()}`;
  const base = normalizeApiBaseUrl(apiBaseUrl);
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data?.ok) {
    const msg =
      (data && data.message) ||
      res.statusText ||
      "places-in-bounds failed";
    const detail = res.status ? ` (HTTP ${res.status})` : "";
    throw new Error(`${msg}${detail}`);
  }
  return {
    places: Array.isArray(data.places) ? data.places : [],
    joinRows: Array.isArray(data.join_rows) ? data.join_rows : [],
  };
}
