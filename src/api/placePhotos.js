import { getAiApiBaseUrl } from "../utils/apiBaseUrl.js";
import { getApiAuthHeaders } from "../utils/apiAuthHeaders.js";

/**
 * 장소 카드 사진 — 서버에서 큐레이터·카카오·구글을 한 번에 병합
 * @param {object} params
 * @param {string} [params.placeId]
 * @param {string} [params.kakaoPlaceId]
 * @param {string} [params.name]
 * @param {string} [params.address]
 * @param {number|null} [params.lat]
 * @param {number|null} [params.lng]
 */
export async function fetchPlacePhotos(params = {}) {
  const qs = new URLSearchParams();
  const placeId = String(params.placeId || "").trim();
  const kakaoPlaceId = String(params.kakaoPlaceId || "").trim();
  const name = String(params.name || "").trim();
  const address = String(params.address || "").trim();

  if (placeId) qs.set("placeId", placeId);
  if (kakaoPlaceId) qs.set("kakaoPlaceId", kakaoPlaceId);
  if (name) qs.set("name", name);
  if (address) qs.set("address", address.slice(0, 120));
  if (params.lat != null && Number.isFinite(Number(params.lat))) {
    qs.set("lat", String(params.lat));
  }
  if (params.lng != null && Number.isFinite(Number(params.lng))) {
    qs.set("lng", String(params.lng));
  }

  const base = getAiApiBaseUrl();
  const path = `/api/place-photos?${qs}`;
  const url = base ? `${base}${path}` : path;

  const res = await fetch(url, { headers: await getApiAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || "place-photos failed");
  }

  const base = getAiApiBaseUrl();
  const normalizeUrl = (path) => {
    if (typeof path !== "string" || !path) return "";
    if (path.startsWith("/") && base) return `${base}${path}`;
    return path;
  };

  return {
    urls: Array.isArray(data.urls)
      ? data.urls.map(normalizeUrl).filter(Boolean)
      : [],
    heroUrl: data.heroUrl ? normalizeUrl(data.heroUrl) : null,
    sources: Array.isArray(data.sources) ? data.sources : [],
    attributions: Array.isArray(data.attributions) ? data.attributions : [],
    curatorPhotos: Array.isArray(data.curator_photos) ? data.curator_photos : [],
  };
}
