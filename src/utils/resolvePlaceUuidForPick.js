import { fetchPlaceUuidByKakaoPlaceId } from "../api/places";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `place_picks.place_id` 는 `places.id`(UUID) 기준.
 * 카카오 전용 행이면 `kakao_place_id` 로 UUID 조회.
 *
 * @param {object | null | undefined} place
 * @returns {Promise<string | null>}
 */
export async function resolvePlaceUuidForPick(place) {
  if (!place || typeof place !== "object") return null;
  const rawId = place.id;
  const idStr = rawId != null ? String(rawId).trim() : "";
  if (idStr && UUID_RE.test(idStr)) return idStr;

  const kakaoRaw =
    place.kakao_place_id ??
    place.place_id ??
    place.kakaoId ??
    (idStr && /^\d+$/.test(idStr) ? idStr : "");
  const kakao = String(kakaoRaw ?? "").trim();
  if (kakao && /^\d+$/.test(kakao)) {
    return await fetchPlaceUuidByKakaoPlaceId(kakao);
  }
  return null;
}
