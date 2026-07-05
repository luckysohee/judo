import { fetchPlaceUuidByKakaoPlaceId } from "../api/places";
import { supabase } from "../lib/supabase";
import { resolvePlaceWgs84, isLikelyKoreaWgs84 } from "./placeCoords";

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

    // kakao id가 비어있거나 과거 데이터 불일치인 경우 대비: 이름/주소로 먼저 조회
    const byNameAddr = await findExistingPlaceUuidByNameAddress(place);
    if (byNameAddr) return byNameAddr;

    if (!createIfMissing) return null;

    const wgs = resolvePlaceWgs84(place);
    const rowPayload = {
      kakao_place_id: kakao,
      name: place.place_name || place.name || "이름 없음",
      address:
        place.road_address_name ||
        place.address_name ||
        place.address ||
        "",
      category: place.category_name || place.category || "",
      lat: Number.isFinite(wgs?.lat) ? wgs.lat : null,
      lng: Number.isFinite(wgs?.lng) ? wgs.lng : null,
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
    // insert/update 실패해도 마지막으로 이름/주소 fallback 재시도
    const fallbackAfterWrite = await findExistingPlaceUuidByNameAddress(place);
    if (fallbackAfterWrite) return fallbackAfterWrite;
    return null;
  }
  const byNameAddrOnly = await findExistingPlaceUuidByNameAddress(place);
  if (byNameAddrOnly) return byNameAddrOnly;

  if (createIfMissing) {
    const wgs = resolvePlaceWgs84(place);
    const name = String(place.place_name || place.name || "").trim();
    if (
      name &&
      wgs &&
      isLikelyKoreaWgs84(wgs.lat, wgs.lng)
    ) {
      const rowPayload = {
        name,
        address: String(
          place.road_address_name ||
            place.address_name ||
            place.address ||
            ""
        ).trim(),
        category: String(place.category_name || place.category || "").trim(),
        lat: wgs.lat,
        lng: wgs.lng,
      };
      const { data: inserted, error: insertErr } = await supabase
        .from("places")
        .insert(rowPayload)
        .select("id")
        .single();
      if (!insertErr && inserted?.id) return String(inserted.id);
      const again = await findExistingPlaceUuidByNameAddress(place);
      if (again) {
        await supabase
          .from("places")
          .update({ lat: wgs.lat, lng: wgs.lng })
          .eq("id", again);
        return again;
      }
    }
  }

  return null;
}

async function findExistingPlaceUuidByNameAddress(place) {
  const rawName = String(place?.place_name || place?.name || "").trim();
  if (!rawName) return null;
  const rawAddr = String(
    place?.road_address_name || place?.address_name || place?.address || ""
  ).trim();

  // 1) 이름+주소 완전 일치 우선
  if (rawAddr) {
    const { data: exactRows, error: exactErr } = await supabase
      .from("places")
      .select("id")
      .eq("name", rawName)
      .eq("address", rawAddr)
      .limit(1);
    if (!exactErr && Array.isArray(exactRows) && exactRows[0]?.id) {
      return String(exactRows[0].id);
    }
  }

  // 2) 이름만 일치 fallback
  const { data: byNameRows, error: byNameErr } = await supabase
    .from("places")
    .select("id")
    .eq("name", rawName)
    .limit(1);
  if (!byNameErr && Array.isArray(byNameRows) && byNameRows[0]?.id) {
    return String(byNameRows[0].id);
  }
  return null;
}
