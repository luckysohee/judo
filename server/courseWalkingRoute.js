import { pathFromKakaoWalkingRoute } from "../src/utils/kakaoWalkingRoutePath.js";

export const KAKAO_WALKING_DIRECTIONS_URL =
  "https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions";

const OSRM_FOOT_URL = "https://router.project-osrm.org/route/v1/foot";

export { pathFromKakaoWalkingRoute };

/**
 * @param {object} p
 * @param {string} p.apiKey
 * @param {number} p.slat
 * @param {number} p.slng
 * @param {number} p.dlat
 * @param {number} p.dlng
 * @param {typeof fetch} [p.fetchImpl]
 */
export async function fetchKakaoWalkingRoute({
  apiKey,
  slat,
  slng,
  dlat,
  dlng,
  fetchImpl = fetch,
}) {
  const key = String(apiKey || "").trim();
  if (!key) {
    return { ok: false, error: "kakao_key_missing" };
  }

  const q = new URLSearchParams({
    origin: `${slng},${slat}`,
    destination: `${dlng},${dlat}`,
    summary: "false",
    priority: "DISTANCE",
  });

  try {
    const r = await fetchImpl(`${KAKAO_WALKING_DIRECTIONS_URL}?${q}`, {
      headers: {
        Authorization: `KakaoAK ${key}`,
        "Content-Type": "application/json",
        service: "judo",
      },
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return {
        ok: false,
        error: r.status === 403 ? "kakao_walking_forbidden" : "kakao_http",
        status: r.status,
        detail: data?.msg || data?.message || "",
      };
    }

    const route = Array.isArray(data?.routes) ? data.routes[0] : null;
    if (!route || Number(route.result_code) !== 0) {
      return {
        ok: false,
        error: "kakao_no_route",
        detail: route?.result_message || route?.result_msg || "",
      };
    }

    const path = pathFromKakaoWalkingRoute(route);
    if (path.length < 2) {
      return { ok: false, error: "kakao_empty_path" };
    }

    const summary = route.summary || {};
    return {
      ok: true,
      path,
      distanceMeters: Math.round(Number(summary.distance) || 0),
      durationSeconds: Math.round(Number(summary.duration) || 0),
      provider: "kakao",
    };
  } catch {
    return { ok: false, error: "kakao_fetch_failed" };
  }
}

/**
 * @param {object} p
 * @param {number} p.slat
 * @param {number} p.slng
 * @param {number} p.dlat
 * @param {number} p.dlng
 * @param {typeof fetch} [p.fetchImpl]
 */
export async function fetchOsrmWalkingRoute({
  slat,
  slng,
  dlat,
  dlng,
  fetchImpl = fetch,
}) {
  const osrmUrl = `${OSRM_FOOT_URL}/${slng},${slat};${dlng},${dlat}?overview=full&geometries=geojson&steps=false`;

  try {
    const r = await fetchImpl(osrmUrl, {
      headers: { "User-Agent": "judo-course-walking-route/1.0" },
    });
    if (!r.ok) {
      return {
        ok: false,
        error: "osrm_http",
        status: r.status,
      };
    }
    const data = await r.json();
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      return { ok: false, error: "osrm_no_route" };
    }
    const path = coords.map(([lng, lat]) => ({
      lat: Number(lat),
      lng: Number(lng),
    }));
    return {
      ok: true,
      path,
      distanceMeters: Math.round(Number(route.distance) || 0),
      durationSeconds: Math.round(Number(route.duration) || 0),
      provider: "osrm",
    };
  } catch {
    return { ok: false, error: "osrm_fetch_failed" };
  }
}

/**
 * 카카오 도보(제휴) 우선 → 실패 시 OSRM foot fallback.
 * @param {object} p
 * @param {string} [p.apiKey]
 * @param {number} p.slat
 * @param {number} p.slng
 * @param {number} p.dlat
 * @param {number} p.dlng
 * @param {typeof fetch} [p.fetchImpl]
 */
export async function resolveCourseWalkingRoute({
  apiKey,
  slat,
  slng,
  dlat,
  dlng,
  fetchImpl = fetch,
}) {
  const kakao = await fetchKakaoWalkingRoute({
    apiKey,
    slat,
    slng,
    dlat,
    dlng,
    fetchImpl,
  });
  if (kakao.ok) return kakao;

  const osrm = await fetchOsrmWalkingRoute({
    slat,
    slng,
    dlat,
    dlng,
    fetchImpl,
  });
  if (osrm.ok) {
    return { ...osrm, fallbackFrom: kakao.error || "kakao_unavailable" };
  }

  return {
    ok: false,
    error: osrm.error || kakao.error || "no_route",
    kakaoError: kakao.error,
    osrmError: osrm.error,
  };
}
