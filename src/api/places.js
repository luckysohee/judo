import { supabase } from "./client";

/**
 * 현재 지도 bounds 안에 있는 장소만 가져옴 (지도용 최소 필드).
 * @param {{ south: number, west: number, north: number, east: number }} bounds
 */
export async function fetchPlacesByBounds({ south, west, north, east }) {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, category, lat, lng")
    .gte("lat", south)
    .lte("lat", north)
    .gte("lng", west)
    .lte("lng", east)
    .order("id", { ascending: true })
    .limit(1000);

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * 장소 상세 — 카드/시트 오픈 후 등에서만 호출
 */
export async function fetchPlaceDetail(placeId) {
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("id", placeId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
