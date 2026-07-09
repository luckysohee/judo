import { pathFromKakaoWalkingRoute } from "./utils/kakaoWalkingRoutePath.js";

export const KAKAO_WALKING_DIRECTIONS_URL =
  "https://apis-navi.kakaomobility.com/affiliate/walking/v1/directions";

/**
 * 한국에서 project-osrm.org 의 `foot` 프로필은 사실상 driving 과 같은
 * 도로 그래프·속도(~10m/s+)를 주는 경우가 많아 도보 루트로 쓰면 안 된다.
 * FOSSGIS routed-foot 는 보행 네트워크·도보 ETA(~1.2m/s)를 사용한다.
 */
const OSRM_FOOT_URLS = [
  "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  "https://router.project-osrm.org/route/v1/foot",
];

/** 이보다 빠르면 자동차/자전거 프로필로 간주하고 버린다 (도보 ~1.2–1.5m/s) */
const MAX_WALK_AVG_SPEED_MPS = 3.2;

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

function isPlausibleWalkingSpeed(distanceMeters, durationSeconds) {
  const dm = Number(distanceMeters) || 0;
  const ds = Number(durationSeconds) || 0;
  if (dm < 40) return true;
  if (ds <= 0) return false;
  return dm / ds <= MAX_WALK_AVG_SPEED_MPS;
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
  const coordPath = `${slng},${slat};${dlng},${dlat}`;
  let lastError = "osrm_no_route";

  for (const base of OSRM_FOOT_URLS) {
    const osrmUrl = `${base}/${coordPath}?overview=full&geometries=geojson&steps=false`;
    try {
      const r = await fetchImpl(osrmUrl, {
        headers: { "User-Agent": "judo-course-walking-route/1.0" },
      });
      if (!r.ok) {
        lastError = "osrm_http";
        continue;
      }
      const data = await r.json();
      const route = data?.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) {
        lastError = "osrm_no_route";
        continue;
      }
      const distanceMeters = Math.round(Number(route.distance) || 0);
      const durationSeconds = Math.round(Number(route.duration) || 0);
      // project-osrm foot 가 자동차 ETA(~10m/s)를 주면 스킵 → FOSSGIS 등 다음 후보
      if (!isPlausibleWalkingSpeed(distanceMeters, durationSeconds)) {
        lastError = "osrm_car_like_speed";
        continue;
      }
      const path = coords.map(([lng, lat]) => ({
        lat: Number(lat),
        lng: Number(lng),
      }));
      return {
        ok: true,
        path,
        distanceMeters,
        durationSeconds,
        provider: "osrm",
        osrmBase: base,
      };
    } catch {
      lastError = "osrm_fetch_failed";
    }
  }

  return { ok: false, error: lastError };
}

/**
 * 카카오 도보(제휴) 우선 → 실패 시 OSRM foot fallback (FOSSGIS 도보 우선).
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
