import { getAiApiBaseUrl } from "../utils/apiBaseUrl.js";
import { getApiAuthHeaders } from "../utils/apiAuthHeaders.js";

/**
 * 카카오 장소 og:image — 서버 캐시 경유 (HTML 스크래핑)
 * @param {string} kakaoPlaceId
 * @returns {Promise<string|null>}
 */
export async function fetchKakaoPlaceOg(kakaoPlaceId) {
  const kid = String(kakaoPlaceId ?? "").trim();
  if (!/^\d+$/.test(kid)) return null;

  const base = getAiApiBaseUrl();
  const path = `/api/kakao-place-og?kakaoPlaceId=${encodeURIComponent(kid)}`;
  const url = base ? `${base}${path}` : path;

  try {
    const res = await fetch(url, { headers: await getApiAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) return null;
    const thumb = typeof data.url === "string" ? data.url.trim() : "";
    return thumb || null;
  } catch {
    return null;
  }
}
