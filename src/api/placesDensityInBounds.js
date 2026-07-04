import { normalizeApiBaseUrl } from "../utils/apiBaseUrl.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";

/**
 * @param {{ south: number, west: number, north: number, east: number, level?: number }} bounds
 * @param {string} [apiBaseUrl]
 * @returns {Promise<{ clusters: { lat: number, lng: number, count: number }[], totalInBounds: number }>}
 */
export async function fetchMapPlaceDensityInBounds(bounds, apiBaseUrl = "", timeoutMs = 6000) {
  const { south, west, north, east, level = 8 } = bounds || {};
  if (![south, west, north, east].every((n) => Number.isFinite(Number(n)))) {
    throw new Error("fetchMapPlaceDensityInBounds: south, west, north, east required");
  }
  const qs = new URLSearchParams({
    south: String(south),
    west: String(west),
    north: String(north),
    east: String(east),
    level: String(Math.floor(Number(level) || 8)),
  });
  const path = `/api/places-density-in-bounds?${qs.toString()}`;
  const base = normalizeApiBaseUrl(apiBaseUrl);
  const url = base ? `${base}${path}` : path;
  const res = await fetchWithTimeout(url, {}, timeoutMs);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data?.ok) {
    const msg =
      (data && data.message) || res.statusText || "places-density-in-bounds failed";
    throw new Error(msg);
  }
  return {
    clusters: Array.isArray(data.clusters) ? data.clusters : [],
    totalInBounds: Number(data.total_in_bounds) || 0,
  };
}
