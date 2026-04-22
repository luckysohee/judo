import { supabase } from "./client";

/** Kakao 지도 level(숫자 클수록 멀리 봄) → bbox places 상한 */
export function getLimitByZoom(level) {
  if (typeof level !== "number" || !Number.isFinite(level)) return 250;
  if (level >= 8) return 60;
  if (level >= 6) return 120;
  return 250;
}

/**
 * 현재 지도 bounds 안에 있는 장소만 가져옴 (지도용 최소 필드).
 * @param {{ south: number, west: number, north: number, east: number, limit?: number }} bounds
 */
export async function fetchPlacesByBounds({
  south,
  west,
  north,
  east,
  limit = 1000,
}) {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, category, lat, lng")
    .gte("lat", south)
    .lte("lat", north)
    .gte("lng", west)
    .lte("lng", east)
    .order("id", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * 장소 상세 — 카드/시트 오픈 후 등에서만 호출
 * @returns {Promise<{ place: object, curatorPlaceRows: object[] }>}
 */
export async function fetchPlaceDetail(placeId) {
  const { data: placeRow, error } = await supabase
    .from("places")
    .select("*")
    .eq("id", placeId)
    .single();

  if (error) {
    throw error;
  }

  const { data: cpRows, error: cpError } = await supabase
    .from("curator_places")
    .select("*")
    .eq("place_id", placeId)
    .eq("is_archived", false);

  if (cpError) {
    throw cpError;
  }

  return {
    place: placeRow,
    curatorPlaceRows: cpRows ?? [],
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
