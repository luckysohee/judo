import { resolvePlaceWgs84, isLikelyKoreaWgs84 } from "./placeCoords";
import { fetchPlacesByBounds } from "../api/places";

/**
 * places JOIN 시 최소 컬럼 — `api/places` bounds 조회와 동일 스키마만 사용.
 * (category_name·address·tags 등 미존재 컬럼 넣으면 PostgREST 42703)
 * 주소·태그 등은 `fetchPlaceDetail` / 카드 오픈 시 보강.
 */
export const PLACES_MAP_LIST_COLUMNS = [
  "id",
  "name",
  "lat",
  "lng",
  "category",
].join(", ");

const PLACES_SELECT = PLACES_MAP_LIST_COLUMNS;

/**
 * 뷰포트에 여유를 둔 bbox (가장자리 핀 깜빡임 완화)
 */
export function padLatLngBounds(sw, ne, padRatio = 0.12) {
  const lat0 = Number(sw?.lat);
  const lng0 = Number(sw?.lng);
  const lat1 = Number(ne?.lat);
  const lng1 = Number(ne?.lng);
  if (
    !Number.isFinite(lat0) ||
    !Number.isFinite(lng0) ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1)
  ) {
    return null;
  }
  const dLat = (lat1 - lat0) * padRatio;
  const dLng = (lng1 - lng0) * padRatio;
  return {
    sw: { lat: lat0 - dLat, lng: lng0 - dLng },
    ne: { lat: lat1 + dLat, lng: lng1 + dLng },
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * bbox 안의 place_id 후보 → curator_places(+가벼운 places) 행.
 * 1단계: `api/places` 의 bounds 조회(최대 300) — 전체 places 스캔 없음.
 */
export async function fetchCuratorPlaceRowsInBounds(
  supabase,
  bounds,
  { chunkSize = 120 } = {}
) {
  const { sw, ne } = bounds;
  if (!sw || !ne) return { rows: [], error: null };

  const south = sw.lat;
  const west = sw.lng;
  const north = ne.lat;
  const east = ne.lng;

  let lightRows;
  try {
    lightRows = await fetchPlacesByBounds({ south, west, north, east });
  } catch (e) {
    return { rows: [], error: e };
  }

  const placeIds = (lightRows || [])
    .map((r) => r?.id)
    .filter((id) => id != null);

  if (placeIds.length === 0) {
    return { rows: [], error: null };
  }

  const allRows = [];
  for (const ids of chunk(placeIds, chunkSize)) {
    const { data, error } = await supabase
      .from("curator_places")
      .select(
        `
        *,
        places (${PLACES_SELECT})
      `
      )
      .eq("is_archived", false)
      .in("place_id", ids);

    if (error) {
      return { rows: allRows, error };
    }
    if (data?.length) allRows.push(...data);
  }

  return { rows: allRows, error: null };
}

/**
 * bbox 밖 좌표면 제외 (resolvePlaceWgs84는 lat/lng·레거시 y/x 모두 처리)
 */
export function filterJoinRowsToBounds(rows, bounds) {
  const { sw, ne } = bounds;
  if (!sw || !ne || !Array.isArray(rows)) return rows;
  return rows.filter((row) => {
    const p = row?.places;
    if (!p) return false;
    const wgs = resolvePlaceWgs84(p);
    if (!wgs || !isLikelyKoreaWgs84(wgs.lat, wgs.lng)) return false;
    return (
      wgs.lat >= sw.lat &&
      wgs.lat <= ne.lat &&
      wgs.lng >= sw.lng &&
      wgs.lng <= ne.lng
    );
  });
}
