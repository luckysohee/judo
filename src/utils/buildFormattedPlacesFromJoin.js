import {
  resolvePlaceWgs84,
  isLikelyKoreaWgs84,
  kakaoNumericPlaceId,
} from "./placeCoords";
import { isHiddenInternalPlaceTag } from "./placeUiTags";
import { liftCuratorCatalogMeta } from "./curatorPlaceMetaLift.js";

function curatorRowPublicKey(curatorPlace) {
  const nm = String(curatorPlace?.curators?.name ?? "").trim();
  const dn = String(
    curatorPlace?.curators?.display_name ??
      curatorPlace?.curators?.displayName ??
      ""
  ).trim();
  const un = String(curatorPlace?.curators?.username ?? "").trim();
  const legacy = String(curatorPlace?.curator_id ?? "").trim();
  return nm || dn || un || legacy || "";
}

/**
 * curator_places × places JOIN 행 → 지도·리스트용 장소 객체 (동기, 외부 API 없음).
 */
export function buildFormattedPlacesFromJoin(joinRows) {
  const placeMap = new Map();
  (joinRows || []).forEach((curatorPlace) => {
    const place = curatorPlace.places;
    if (!place) return;

    const wgsMerge = resolvePlaceWgs84(place);
    const useLatLngMergeKey =
      wgsMerge &&
      Number.isFinite(wgsMerge.lat) &&
      Number.isFinite(wgsMerge.lng) &&
      isLikelyKoreaWgs84(wgsMerge.lat, wgsMerge.lng);
    const key = useLatLngMergeKey
      ? `${wgsMerge.lat}_${wgsMerge.lng}`
      : `id:${place.id ?? curatorPlace.place_id ?? "unknown"}`;

    if (placeMap.has(key)) {
      const existing = placeMap.get(key);
      existing.curatorCount = (existing.curatorCount || 0) + 1;
      const ck = curatorRowPublicKey(curatorPlace);
      if (ck) existing.curators.push(ck);
      existing.curatorPlaces.push(curatorPlace);
    } else {
      const ck = curatorRowPublicKey(curatorPlace);
      placeMap.set(key, {
        ...place,
        curatorCount: 1,
        curators: ck ? [ck] : [],
        curatorPlaces: [curatorPlace],
      });
    }
  });

  const formattedPlaces = Array.from(placeMap.values()).map((place) => {
    const curatorReasons = {};
    const curatorNames = [];

    place.curatorPlaces.forEach((curatorPlace) => {
      const curatorName =
        String(curatorPlace.curators?.name ?? "").trim() ||
        String(
          curatorPlace.curators?.display_name ??
            curatorPlace.curators?.displayName ??
            ""
        ).trim() ||
        String(curatorPlace.curators?.username ?? "").trim() ||
        String(curatorPlace.display_name ?? "").trim() ||
        String(curatorPlace.curator_id ?? "").trim() ||
        "";

      curatorNames.push(curatorName);
      curatorReasons[curatorName] =
        curatorPlace.one_line_reason ||
        curatorPlace.menu_reason ||
        curatorPlace.one_line_review ||
        "";
    });

    const wgs = resolvePlaceWgs84(place);
    const kakaoNumId = kakaoNumericPlaceId(place);
    const tagSet = new Set();
    const vibeSet = new Set();
    const addStrTags = (arr) => {
      if (!Array.isArray(arr)) return;
      for (const t of arr) {
        const s = typeof t === "string" ? t.trim() : "";
        if (s && !isHiddenInternalPlaceTag(s)) tagSet.add(s);
      }
    };
    if (Array.isArray(place.tags)) addStrTags(place.tags);
    if (Array.isArray(place.vibes)) {
      for (const v of place.vibes) {
        const s = typeof v === "string" ? v.trim() : "";
        if (s) vibeSet.add(s);
      }
    }
    place.curatorPlaces?.forEach((cp) => {
      if (Array.isArray(cp.tags)) addStrTags(cp.tags);
      const moods = cp.moods;
      if (Array.isArray(moods)) {
        for (const m of moods) {
          const s = typeof m === "string" ? m.trim() : "";
          if (s) vibeSet.add(s);
        }
      }
    });

    const liftedMeta = liftCuratorCatalogMeta({
      ...place,
      curatorReasons,
      curatorPlaces: place.curatorPlaces,
    });

    return {
      id: place.id,
      name: place.name,
      ...liftedMeta,
      ...(wgs
        ? {
            lat: wgs.lat,
            lng: wgs.lng,
            x: String(wgs.lng),
            y: String(wgs.lat),
          }
        : {}),
      category:
        (place.category_name && String(place.category_name).trim()) ||
        (place.category && String(place.category).trim()) ||
        "미분류",
      category_name:
        (place.category_name && String(place.category_name).trim()) ||
        (place.category && String(place.category).trim()) ||
        "",
      phone: place.phone || "",
      address: place.address || place.road_address_name || place.address_name || "",
      address_name: place.address_name || "",
      road_address_name: place.road_address_name || "",
      place_url: place.place_url || "",
      place_id: kakaoNumId,
      kakao_place_id: kakaoNumId,
      kakaoId: kakaoNumId,
      isKakaoPlace: Boolean(place.place_url || kakaoNumId),
      curatorCount: place.curatorCount,
      curators: curatorNames,
      curatorUsernames: (() => {
        const ids = [];
        const seen = new Set();
        const add = (v) => {
          if (v == null) return;
          const s = String(v).trim();
          if (!s || seen.has(s)) return;
          seen.add(s);
          ids.push(s);
        };
        for (const cp of place.curatorPlaces || []) {
          add(cp.curator_id);
          add(cp.curators?.username);
          add(cp.curators?.name);
          add(cp.curators?.display_name);
          add(cp.curators?.displayName);
          add(cp.curators?.user_id);
          add(cp.curators?.id);
          const pub = curatorRowPublicKey(cp);
          if (pub) add(pub);
        }
        return ids;
      })(),
      curatorReasons,
      curatorPlaces: place.curatorPlaces,
      comment: "",
      savedCount: 0,
      tags: [...tagSet],
      moods: [...vibeSet],
      vibes: [...vibeSet],
      is_public: Array.isArray(place.curatorPlaces)
        ? place.curatorPlaces.some((cp) => cp.is_archived !== true)
        : true,
    };
  });

  if (import.meta.env.DEV) {
    console.log("🔍 지도 집계 장소 수:", formattedPlaces.length);
  }
  return formattedPlaces;
}
