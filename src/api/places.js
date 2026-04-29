import { supabase } from "./client";

/** Kakao 지도 level(숫자 클수록 멀리 봄) → bbox places 상한 */
export function getLimitByZoom(level) {
  if (typeof level !== "number" || !Number.isFinite(level)) return 250;
  if (level >= 8) return 60;
  if (level >= 6) return 120;
  return 250;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 장소 상세 — 카드/시트 오픈 후 등에서만 호출.
 * 서버 `GET /api/place-detail` (service role + 컬럼 화이트리스트, curator_id 미반환).
 *
 * @param {string} placeId UUID
 * @param {string} [apiBaseUrl] `VITE_AI_API_BASE_URL` — 비우면 상대 경로(프록시)
 * @returns {Promise<{ place: object, curatorPlaceRows: object[] }>}
 */
export async function fetchPlaceDetail(placeId, apiBaseUrl = "") {
  const id = String(placeId ?? "").trim();
  if (!id || !UUID_RE.test(id)) {
    throw new Error("fetchPlaceDetail: invalid place id");
  }
  const base = String(apiBaseUrl || "").replace(/\/$/, "");
  const path = `/api/place-detail?id=${encodeURIComponent(id)}`;
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
      (data && data.message) || res.statusText || "place-detail failed";
    throw new Error(msg);
  }
  return {
    place: data.place,
    curatorPlaceRows: Array.isArray(data.curator_place_rows)
      ? data.curator_place_rows
      : [],
  };
}

/**
 * DB에 등록된 카카오 숫자 장소 ID → `places.id`(UUID)
 */
export async function fetchPlaceUuidByKakaoPlaceId(kakaoPlaceId) {
  const kid = String(kakaoPlaceId ?? "").trim();
  if (!/^\d+$/.test(kid)) return null;
  const { data, error } = await supabase
    .from("places")
    .select("id")
    .eq("kakao_place_id", kid)
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}
