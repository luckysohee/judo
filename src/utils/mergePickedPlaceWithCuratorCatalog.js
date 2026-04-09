import { resolvePlaceWgs84, kakaoNumericPlaceId } from "./placeCoords";

function extractedKakaoIdFromUrl(place) {
  return place?.place_url?.match(/\/place\/(\d+)/)?.[1] || null;
}

/** 카카오 숫자 장소 ID 한 가지로 정규화 (없으면 null) */
export function normalizeKakaoPlaceId(place) {
  if (!place || typeof place !== "object") return null;
  const fromUrl = extractedKakaoIdFromUrl(place);
  const rawId = place.id;
  const stripped =
    typeof rawId === "string" && rawId.startsWith("kakao_")
      ? rawId.slice(6)
      : null;
  const candidates = [
    place.kakao_place_id,
    place.place_id,
    place.kakaoId,
    stripped,
    typeof rawId === "string" && /^\d+$/.test(rawId.trim())
      ? rawId.trim()
      : null,
    typeof rawId === "number" ? String(rawId) : null,
    fromUrl,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const s = String(c).trim();
    if (/^\d+$/.test(s)) return s;
  }
  return null;
}

function normalizePlaceName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function haversineM(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * picked(검색·카카오 마커 등)와 동일한 장소인 catalog 행 찾기
 * @param {object} picked
 * @param {object[]} catalog - Home의 dbPlaces 등 (큐레이터 병합된 장소 목록)
 */
export function findCuratorCatalogMatch(picked, catalog) {
  if (!picked || !Array.isArray(catalog) || catalog.length === 0) return null;

  const kid = normalizeKakaoPlaceId(picked);
  if (kid) {
    for (const c of catalog) {
      if (normalizeKakaoPlaceId(c) === kid) return c;
    }
  }

  const pid = picked.id;
  if (
    pid != null &&
    typeof pid === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      pid
    )
  ) {
    for (const c of catalog) {
      if (String(c.id) === String(pid)) return c;
    }
  }

  const w1 = resolvePlaceWgs84(picked);
  const n1 = normalizePlaceName(picked.name || picked.place_name);
  if (w1 && n1.length >= 2) {
    for (const c of catalog) {
      const w2 = resolvePlaceWgs84(c);
      if (!w2) continue;
      if (haversineM(w1, w2) > 55) continue;
      if (normalizePlaceName(c.name) === n1) return c;
    }
  }

  return null;
}

/**
 * 검색/지도에서 연 장소를 큐레이터 DB 카드와 같은 내용으로 맞춤
 * (curatorPlaces, 한 줄 평, UUID id 등)
 */
export function mergePickedPlaceWithCuratorCatalog(picked, catalog) {
  if (!picked || typeof picked !== "object") return picked;
  const canonical = findCuratorCatalogMatch(picked, catalog);
  if (!canonical) return picked;

  const wP = resolvePlaceWgs84(picked);
  const wC = resolvePlaceWgs84(canonical);
  const mergedKakaoNumId =
    kakaoNumericPlaceId(canonical) || kakaoNumericPlaceId(picked);

  return {
    ...picked,
    id: canonical.id,
    name: canonical.name || picked.name || picked.place_name,
    category_name:
      (canonical.category_name && String(canonical.category_name).trim()) ||
      (picked.category_name && String(picked.category_name).trim()) ||
      (canonical.category && String(canonical.category).trim()) ||
      (picked.category && String(picked.category).trim()) ||
      "",
    category:
      (canonical.category_name && String(canonical.category_name).trim()) ||
      (canonical.category && String(canonical.category).trim()) ||
      (picked.category_name && String(picked.category_name).trim()) ||
      (picked.category && String(picked.category).trim()) ||
      "미분류",
    phone: picked.phone || canonical.phone,
    address:
      picked.address ||
      canonical.address ||
      picked.road_address_name ||
      canonical.road_address_name,
    road_address_name:
      picked.road_address_name || canonical.road_address_name || "",
    address_name: picked.address_name || canonical.address_name || "",
    place_url: picked.place_url || canonical.place_url,
    place_id: canonical.place_id || picked.place_id,
    kakao_place_id: canonical.kakao_place_id || picked.kakao_place_id,
    kakaoId: canonical.kakaoId || picked.kakaoId,
    lat: wP?.lat ?? wC?.lat ?? picked.lat,
    lng: wP?.lng ?? wC?.lng ?? picked.lng,
    x: picked.x ?? canonical.x,
    y: picked.y ?? canonical.y,
    curatorPlaces: canonical.curatorPlaces,
    curatorCount: canonical.curatorCount,
    curators: canonical.curators,
    curatorUsernames: canonical.curatorUsernames,
    curatorReasons: canonical.curatorReasons,
    is_public: canonical.is_public,
    isKakaoPlace: Boolean(
      mergedKakaoNumId ||
        picked.isKakaoPlace ||
        canonical.isKakaoPlace ||
        picked.place_url ||
        canonical.place_url
    ),
    blogInsight: picked.blogInsight ?? canonical.blogInsight,
    tags:
      Array.isArray(canonical.tags) && canonical.tags.length
        ? canonical.tags
        : picked.tags,
    vibes:
      Array.isArray(canonical.vibes) && canonical.vibes.length
        ? canonical.vibes
        : picked.vibes,
    food_types: canonical.food_types ?? picked.food_types,
    alcohol_types: canonical.alcohol_types ?? picked.alcohol_types,
    purposes: canonical.purposes ?? picked.purposes,
    distance: picked.distance,
    walkingTime: picked.walkingTime,
    matchedFacetLabels: picked.matchedFacetLabels,
    searchRepresentativeTag: picked.searchRepresentativeTag,
    recommendation: picked.recommendation ?? canonical.recommendation,
  };
}
