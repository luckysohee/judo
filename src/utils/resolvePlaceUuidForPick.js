import { fetchPlaceUuidByKakaoPlaceId } from "../api/places";
import { supabase } from "../lib/supabase";
import { resolvePlaceWgs84 } from "./placeCoords";

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
  return ensurePlaceUuidForPick(place, { createIfMissing: false });
}

/**
 * 픽용 UUID 확보.
 * - 기본: 기존 places에서 조회만
 * - createIfMissing=true: 카카오 장소면 최소 필드로 places에 insert/update 후 UUID 반환
 */
export async function ensurePlaceUuidForPick(
  place,
  { createIfMissing = false } = {}
) {
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
    const existing = await fetchPlaceUuidByKakaoPlaceId(kakao);
    if (existing) return existing;
    if (!createIfMissing) return null;

    const wgs = resolvePlaceWgs84(place);
    if (!wgs || !Number.isFinite(wgs.lat) || !Number.isFinite(wgs.lng)) {
      return null;
    }

    const rowPayload = {
      kakao_place_id: kakao,
      name: place.place_name || place.name || "이름 없음",
      address:
        place.road_address_name ||
        place.address_name ||
        place.address ||
        "",
      category: place.category_name || place.category || "",
      lat: wgs.lat,
      lng: wgs.lng,
    };

    const { data: existingRows, error: selectError } = await supabase
      .from("places")
      .select("id")
      .eq("kakao_place_id", kakao)
      .limit(1);
    if (selectError) return null;

    const existingId = existingRows?.[0]?.id;
    const { data: savedPlace, error: writeError } = existingId
      ? await supabase
          .from("places")
          .update(rowPayload)
          .eq("id", existingId)
          .select("id")
          .single()
      : await supabase.from("places").insert(rowPayload).select("id").single();

    if (!writeError && savedPlace?.id) return String(savedPlace.id);

    if (writeError?.code === "23505") {
      const refetch = await fetchPlaceUuidByKakaoPlaceId(kakao);
      if (refetch) return refetch;
    }
    return null;
  }
  return null;
}
