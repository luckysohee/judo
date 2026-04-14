// 비우면 Vite `/api` → server 프록시 (kakaoAPIProxy와 동일 규칙)
const API_BASE_URL = (
  import.meta.env.VITE_AI_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ""
).replace(/\/$/, "");

/**
 * 1차→2차 보행 경로 폴리라인 (서버 OSRM 프록시).
 * @returns {Promise<{ ok: true, path: {lat,lng}[], distanceMeters: number, durationSeconds: number } | { ok: false, error?: string }>}
 */
export async function fetchCourseWalkingRoute(slat, slng, dlat, dlng) {
  const q = new URLSearchParams({
    slat: String(slat),
    slng: String(slng),
    dlat: String(dlat),
    dlng: String(dlng),
  });
  const path = API_BASE_URL
    ? `${API_BASE_URL}/api/course-walking-route?${q}`
    : `/api/course-walking-route?${q}`;
  try {
    const r = await fetch(path);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      return { ok: false, error: data?.error || "http" };
    }
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
}
