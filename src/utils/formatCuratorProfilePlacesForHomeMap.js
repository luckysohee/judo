import { formatBoundsPlaceRowsForMap } from "./formatBoundsPlaceRowsForMap";
import { resolvePlaceWgs84 } from "./placeCoords";

/**
 * 큐레이터 프로필 `fetchPlacesForCuratorPage` 행 → 홈 지도·칩 필터 호환 객체
 */
export function formatCuratorProfilePlaceForHomeMap(place, curatorAuthUserId) {
  if (!place || typeof place !== "object") return null;
  const base = formatBoundsPlaceRowsForMap([place])[0];
  if (!base) return null;
  const cid = String(curatorAuthUserId ?? "").trim();
  const comment =
    place.comment != null && String(place.comment).trim()
      ? String(place.comment).trim()
      : "";
  const w = resolvePlaceWgs84(place);
  return {
    ...base,
    ...place,
    name: place.name ?? base.name,
    lat: w?.lat ?? base.lat,
    lng: w?.lng ?? base.lng,
    x: w?.lng != null ? String(w.lng) : base.x,
    y: w?.lat != null ? String(w.lat) : base.y,
    comment,
    curatorCount: cid ? 1 : 0,
    curatorPlaces: cid
      ? [
          {
            curator_id: cid,
            one_line_reason: comment || null,
          },
        ]
      : [],
    is_public: place.is_public !== false,
  };
}

export function formatCuratorProfilePlacesForHomeMap(places, curatorAuthUserId) {
  return (places || [])
    .map((p) => formatCuratorProfilePlaceForHomeMap(p, curatorAuthUserId))
    .filter(Boolean);
}

/** 큐레이터 프로필 미니 지도(`MapView`)용 */
export function formatCuratorProfilePlacesForMapView(
  places,
  curatorDisplayName
) {
  const label = String(curatorDisplayName ?? "").trim();
  return (places || [])
    .map((row) => {
      const w = resolvePlaceWgs84(row);
      if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) return null;
      return {
        id: row.id,
        name: row.name,
        region: row.region,
        address: row.address,
        image: row.image_url,
        comment: row.comment,
        lat: w.lat,
        lng: w.lng,
        x: String(w.lng),
        y: String(w.lat),
        savedCount: Number(row.save_count || 0),
        curators: label ? [label] : [],
        primaryCurator: label || undefined,
        tags: [],
        is_public: row.is_public !== false,
      };
    })
    .filter(Boolean);
}
