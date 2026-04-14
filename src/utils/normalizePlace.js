import { resolvePlaceWgs84 } from "./placeCoords.js";

function toStringArray(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,|]/g)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Supabase `places` 등 원본 → 코스 엔진·UI용 공통 shape.
 * 컬럼명이 달라도 여기서 흡수.
 */
export function normalizePlace(place) {
  if (!place || typeof place !== "object") return null;

  const wgs = resolvePlaceWgs84(place);
  const lat = wgs?.lat;
  const lng = wgs?.lng;

  const areaName =
    place.primary_area ||
    place.area_name ||
    place.areaName ||
    place.region ||
    place.address_name ||
    place.address ||
    "";

  const categories = toStringArray(place.categories);
  const categoryStr = String(place.category_name || place.category || "").trim();
  if (categoryStr && categories.length === 0) {
    categories.push(
      ...categoryStr
        .split(/[>,]/g)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  const vibes = [
    ...toStringArray(place.vibes),
    ...toStringArray(place.visit_situations),
  ];
  const uniq = (arr) => [...new Set(arr)];

  let openingHours = place.opening_hours ?? place.openingHours ?? null;
  if (typeof openingHours === "string" && openingHours.trim()) {
    try {
      openingHours = JSON.parse(openingHours);
    } catch {
      openingHours = null;
    }
  }
  if (openingHours && typeof openingHours !== "object") openingHours = null;

  const closeTimeRaw = place.close_time ?? place.closeTime ?? null;
  const closeTime =
    closeTimeRaw != null && String(closeTimeRaw).trim()
      ? String(closeTimeRaw).trim()
      : null;

  return {
    id: place.id ?? place.place_id ?? place.kakao_place_id,
    name: String(place.name || place.place_name || "").trim(),
    areaName: String(areaName).trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,

    categories: uniq(categories),
    vibes: uniq(vibes),
    liquorTypes: toStringArray(place.liquor_types || place.liquorTypes),
    tags: uniq(toStringArray(place.tags)),

    curatorCount: Number(place.curator_count ?? place.curatorCount ?? 0) || 0,
    overlapCuratorCount:
      Number(place.overlap_curator_count ?? place.overlapCuratorCount ?? 0) || 0,

    openNow:
      typeof place.open_now === "boolean"
        ? place.open_now
        : typeof place.openNow === "boolean"
          ? place.openNow
          : null,

    closeTime,
    openingHours,

    category_name: categoryStr,
    address_name: place.address_name || place.address || "",
    place_name: place.place_name || place.name,
    /** 원본 유지(지도·미리보기 병합용) */
    _raw: place,
  };
}

export function normalizePlaces(places = []) {
  return places
    .map(normalizePlace)
    .filter((p) => p && p.id != null && p.name && p.lat != null && p.lng != null);
}
