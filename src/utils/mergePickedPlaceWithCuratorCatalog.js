import { resolvePlaceWgs84, kakaoNumericPlaceId } from "./placeCoords";
import { collectReasonEvidence } from "./reasonEvidence.js";

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
  const strippedLocal =
    typeof rawId === "string" && rawId.startsWith("local_")
      ? rawId.slice(6)
      : null;
  const candidates = [
    place.kakao_place_id,
    place.place_id,
    place.kakaoId,
    stripped,
    strippedLocal,
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

function curatorRichnessScore(p) {
  if (!p || typeof p !== "object") return 0;
  let s = 0;
  if (Array.isArray(p.curatorPlaces)) s += p.curatorPlaces.length * 20;
  if (Array.isArray(p.curators)) s += p.curators.length * 6;
  if (typeof p.curatorCount === "number") s += p.curatorCount * 4;
  return s;
}

function isUuidLike(id) {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  );
}

function isKakaoApiShape(p) {
  if (!p) return false;
  if (p.isKakaoPlace) return true;
  const sid = p.id;
  if (typeof sid === "string" && sid.startsWith("kakao_")) return true;
  if (typeof sid === "string" && sid.startsWith("local_")) return true;
  if (typeof sid === "string" && /^\d+$/.test(sid.trim())) return true;
  return false;
}

/**
 * 동일 카카오 숫자 장소 id인 행을 하나로 합침.
 * DB UUID 행과 검색 kakao_* 행이 동시에 있으면 메타는 UUID·큐레이터 쪽을 유지하고,
 * 좌표가 크게 어긋나면(>40m) 카카오 API 쪽 y/x를 신뢰해 마커 위치를 맞춤.
 */
function mergeTwoPlacesSameKakaoId(a, b) {
  const [primary, secondary] =
    isUuidLike(a?.id) && !isUuidLike(b?.id)
      ? [a, b]
      : isUuidLike(b?.id) && !isUuidLike(a?.id)
      ? [b, a]
      : curatorRichnessScore(a) >= curatorRichnessScore(b)
      ? [a, b]
      : [b, a];

  const wP = resolvePlaceWgs84(primary);
  const wS = resolvePlaceWgs84(secondary);
  const meters = wP && wS ? haversineM(wP, wS) : 0;

  let lat = primary.lat;
  let lng = primary.lng;
  let x = primary.x;
  let y = primary.y;
  /** DB UUID(큐레이터) 좌표가 오래·오류인 경우가 많아, 같은 업소의 카카오 검색 좌표를 지도에 우선한다. */
  const uuidPrimaryKakaoSecondary =
    isUuidLike(primary?.id) && isKakaoApiShape(secondary) && wS;
  if (uuidPrimaryKakaoSecondary) {
    lat = wS.lat;
    lng = wS.lng;
    x = secondary.x != null && secondary.x !== "" ? secondary.x : x;
    y = secondary.y != null && secondary.y !== "" ? secondary.y : y;
  } else if (meters > 40 && isKakaoApiShape(secondary) && wS) {
    lat = wS.lat;
    lng = wS.lng;
    x = secondary.x != null && secondary.x !== "" ? secondary.x : x;
    y = secondary.y != null && secondary.y !== "" ? secondary.y : y;
  }

  const seenCp = new Set();
  const curatorPlaces = [];
  for (const row of [primary, secondary]) {
    for (const cp of row?.curatorPlaces || []) {
      const key = String(cp?.id ?? cp?.curator_id ?? JSON.stringify(cp));
      if (seenCp.has(key)) continue;
      seenCp.add(key);
      curatorPlaces.push(cp);
    }
  }

  const curators = [
    ...new Set([...(primary.curators || []), ...(secondary.curators || [])]),
  ];

  const mergedCore = {
    ...secondary,
    ...primary,
    id: primary.id,
    lat,
    lng,
    x,
    y,
    curatorPlaces,
    curators,
    curatorCount: Math.max(
      primary.curatorCount || 0,
      secondary.curatorCount || 0,
      curators.length
    ),
    kakao_place_id: primary.kakao_place_id || secondary.kakao_place_id,
    place_id: primary.place_id || secondary.place_id,
    place_url: primary.place_url || secondary.place_url,
    phone: primary.phone || secondary.phone,
    address:
      primary.address ||
      secondary.address ||
      primary.road_address_name ||
      secondary.road_address_name,
    road_address_name:
      primary.road_address_name || secondary.road_address_name || "",
    address_name: primary.address_name || secondary.address_name || "",
    blogInsight: primary.blogInsight ?? secondary.blogInsight,
  };
  return {
    ...mergedCore,
    reasonEvidence: collectReasonEvidence(mergedCore),
  };
}

/**
 * 지도 마커용: 같은 카카오 업소가 id만 달라 두 번 들어오는 경우 1개로 합침.
 * @param {object[]} places
 * @returns {object[]}
 */
export function dedupeMapPlacesByKakaoId(places) {
  if (!Array.isArray(places) || places.length < 2) return places;

  const byKid = new Map();
  const noKid = [];
  for (const p of places) {
    const kid = normalizeKakaoPlaceId(p);
    if (!kid) {
      noKid.push(p);
      continue;
    }
    if (!byKid.has(kid)) byKid.set(kid, []);
    byKid.get(kid).push(p);
  }

  const out = [];
  for (const group of byKid.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    let acc = group[0];
    for (let i = 1; i < group.length; i++) {
      acc = mergeTwoPlacesSameKakaoId(acc, group[i]);
    }
    out.push(acc);
  }
  return [...out, ...noKid];
}

/**
 * 검색/지도에서 연 장소를 큐레이터 DB 카드와 같은 내용으로 맞춤
 * (curatorPlaces, 한 줄 평, UUID id 등)
 */
export function mergePickedPlaceWithCuratorCatalog(picked, catalog) {
  if (!picked || typeof picked !== "object") return picked;
  const canonical = findCuratorCatalogMatch(picked, catalog);
  if (!canonical) {
    const w = resolvePlaceWgs84(picked);
    if (!w) {
      return { ...picked, reasonEvidence: collectReasonEvidence(picked) };
    }
    const out = {
      ...picked,
      lat: w.lat,
      lng: w.lng,
      x: picked.x != null && picked.x !== "" ? picked.x : String(w.lng),
      y: picked.y != null && picked.y !== "" ? picked.y : String(w.lat),
    };
    return {
      ...out,
      reasonEvidence: collectReasonEvidence(out),
    };
  }

  const wP = resolvePlaceWgs84(picked);
  const wC = resolvePlaceWgs84(canonical);
  const mergedKakaoNumId =
    kakaoNumericPlaceId(canonical) || kakaoNumericPlaceId(picked);

  const merged = {
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
  const wFix = resolvePlaceWgs84(merged);
  if (!wFix) {
    return {
      ...merged,
      reasonEvidence: collectReasonEvidence(merged),
    };
  }
  const withCoords = {
    ...merged,
    lat: wFix.lat,
    lng: wFix.lng,
    x:
      merged.x != null && merged.x !== ""
        ? merged.x
        : String(wFix.lng),
    y:
      merged.y != null && merged.y !== ""
        ? merged.y
        : String(wFix.lat),
  };
  return {
    ...withCoords,
    reasonEvidence: collectReasonEvidence(withCoords),
  };
}
