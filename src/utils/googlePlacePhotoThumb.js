const API_BASE_URL = (
  import.meta.env.VITE_AI_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/$/, "");

/**
 * @param {{ name?: string, address?: string, lat?: number|null, lng?: number|null }} step
 * @returns {Promise<string|null>}
 */
export async function fetchGooglePlacePhotoThumb(step) {
  const name = String(step?.name || "").trim();
  if (!name) return null;
  const address = String(step?.address || "").trim();
  const lat = Number(step?.lat);
  const lng = Number(step?.lng);
  const qs = new URLSearchParams({ name });
  if (address) qs.set("address", address.slice(0, 120));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    qs.set("lat", String(lat));
    qs.set("lng", String(lng));
  }
  const path = `/api/google-place-photos?${qs.toString()}`;
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    const first = Array.isArray(data?.imageUrls)
      ? String(data.imageUrls[0] || "").trim()
      : "";
    if (!first) return null;
    if (first.startsWith("/") && API_BASE_URL) return `${API_BASE_URL}${first}`;
    return /^https?:\/\//i.test(first) ? first : null;
  } catch {
    return null;
  }
}
