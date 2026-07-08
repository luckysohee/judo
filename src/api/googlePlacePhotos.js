import { getAiApiBaseUrl } from "../utils/apiBaseUrl.js";
import { getApiAuthHeaders } from "../utils/apiAuthHeaders.js";

function normalizeProxyUrl(u, base) {
  if (typeof u !== "string" || !u) return "";
  const s = u.trim();
  if (!s) return "";
  if (s.startsWith("/") && base) return `${base}${s}`;
  return /^https?:\/\//i.test(s) ? s : "";
}

/**
 * 구글 Places 사진 — 백그라운드 보강용
 * @param {object} params
 * @param {string} params.name
 * @param {string} [params.address]
 * @param {number|null} [params.lat]
 * @param {number|null} [params.lng]
 */
export async function fetchGooglePlacePhotos(params = {}) {
  const name = String(params.name || "").trim();
  if (!name) {
    return { urls: [], attributions: [], sources: [] };
  }

  const qs = new URLSearchParams({ name });
  const address = String(params.address || "").trim();
  if (address) qs.set("address", address.slice(0, 120));
  if (params.lat != null && Number.isFinite(Number(params.lat))) {
    qs.set("lat", String(params.lat));
  }
  if (params.lng != null && Number.isFinite(Number(params.lng))) {
    qs.set("lng", String(params.lng));
  }

  const base = getAiApiBaseUrl();
  const path = `/api/google-place-photos?${qs}`;
  const url = base ? `${base}${path}` : path;

  try {
    const res = await fetch(url, { headers: await getApiAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    const urls = Array.isArray(data?.imageUrls)
      ? data.imageUrls.map((u) => normalizeProxyUrl(u, base)).filter(Boolean)
      : [];
    return {
      urls,
      attributions: Array.isArray(data?.attributions) ? data.attributions : [],
      sources: urls.length > 0 ? ["google"] : [],
    };
  } catch {
    return { urls: [], attributions: [], sources: [] };
  }
}
