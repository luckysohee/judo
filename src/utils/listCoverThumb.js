import { supabase } from "../lib/supabase";
import { rewriteLegacySupabaseStorageUrl } from "./rewriteLegacySupabaseStorageUrl";
import {
  isResolvableCourseStepThumbUrl,
  resolveCourseStepThumbUrl,
} from "./courseStepThumb";

/**
 * @param {object|null|undefined} list
 * @returns {string}
 */
export function pickListDisplayCoverUrl(list) {
  const u = rewriteLegacySupabaseStorageUrl(
    String(list?.cover_image_url || "").trim()
  );
  return isResolvableCourseStepThumbUrl(u) ? u : "";
}

function placeThumbFromListPlaceRow(row) {
  if (!row || typeof row !== "object") return null;
  const pl = row.places && typeof row.places === "object" ? row.places : {};
  const listImg = rewriteLegacySupabaseStorageUrl(
    String(row.image_url || "").trim()
  );
  const placeImg = rewriteLegacySupabaseStorageUrl(
    String(pl.image_url || "").trim()
  );
  const uploaded = isResolvableCourseStepThumbUrl(listImg)
    ? listImg
    : isResolvableCourseStepThumbUrl(placeImg)
      ? placeImg
      : "";
  return {
    place_id: String(row.place_id || pl.id || "").trim() || null,
    name: String(pl.name || pl.place_name || "").trim(),
    address: String(pl.address || "").trim(),
    lat: Number.isFinite(Number(pl.lat)) ? Number(pl.lat) : null,
    lng: Number.isFinite(Number(pl.lng)) ? Number(pl.lng) : null,
    kakao_place_id: String(pl.kakao_place_id || "").trim() || null,
    image_url: uploaded || null,
  };
}

/**
 * 커버·장소 미리보기용 — 1번째 장소 메타 + 상위 장소명.
 * @param {object[]} lists
 */
export async function hydrateListsWithFirstPlace(lists) {
  if (!Array.isArray(lists) || lists.length === 0) return lists;

  const needIds = [];
  for (const list of lists) {
    const id = String(list?.id || "").trim();
    if (!id) continue;
    const hasCover =
      Boolean(pickListDisplayCoverUrl(list)) || Boolean(list?._cover_place);
    const hasPlaces = Array.isArray(list?._placeNames);
    if (hasCover && hasPlaces) continue;
    needIds.push(id);
  }
  if (needIds.length === 0) return lists;

  const uniqueIds = [...new Set(needIds)];
  /** places.place_name / places.image_url 은 환경에 따라 없어 400 → 코스 hydrate와 동일한 안전 컬럼만 */
  const selectWithListImage = `
    list_id, order_index, place_id, image_url,
    places ( id, name, address, lat, lng, kakao_place_id )
  `;
  const selectBasic = `
    list_id, order_index, place_id,
    places ( id, name, address, lat, lng, kakao_place_id )
  `;

  let res = await supabase
    .from("curator_list_places")
    .select(selectWithListImage)
    .in("list_id", uniqueIds)
    .order("order_index", { ascending: true });

  if (res.error) {
    res = await supabase
      .from("curator_list_places")
      .select(selectBasic)
      .in("list_id", uniqueIds)
      .order("order_index", { ascending: true });
  }

  if (res.error || !Array.isArray(res.data) || res.data.length === 0) {
    if (res.error && import.meta.env.DEV) {
      console.warn("[listCoverThumb] hydrate first place failed:", res.error);
    }
    return lists;
  }

  const firstByList = new Map();
  const namesByList = new Map();
  for (const row of res.data) {
    const lid = String(row.list_id || "").trim().toLowerCase();
    if (!lid) continue;
    const step = placeThumbFromListPlaceRow(row);
    if (step && !firstByList.has(lid)) firstByList.set(lid, step);
    const placeName = String(step?.name || "").trim();
    if (placeName) {
      let names = namesByList.get(lid);
      if (!names) {
        names = [];
        namesByList.set(lid, names);
      }
      if (names.length < 3 && !names.includes(placeName)) {
        names.push(placeName);
      }
    }
  }

  return lists.map((list) => {
    const lid = String(list?.id || "").trim().toLowerCase();
    const step = firstByList.get(lid);
    const names = namesByList.get(lid);
    let next = list;
    if (step && !list?._cover_place) {
      next = { ...next, _cover_place: step };
    }
    if (names?.length && !Array.isArray(list?._placeNames)) {
      next = { ...next, _placeNames: names };
    }
    return next;
  });
}

/**
 * 커버 없을 때 1번째 장소 업로드/카카오 사진으로 보강 (코스 enrichCoursesWithAutoCover 대응)
 * @param {object[]} lists
 */
export async function enrichListsWithAutoCover(lists) {
  if (!Array.isArray(lists) || lists.length === 0) return lists;
  const hydrated = await hydrateListsWithFirstPlace(lists);
  return Promise.all(
    hydrated.map(async (list) => {
      const explicit = pickListDisplayCoverUrl(list);
      if (explicit) return { ...list, cover_image_url: explicit };

      const first = list?._cover_place;
      if (!first) return list;

      const uploaded = rewriteLegacySupabaseStorageUrl(
        String(first.image_url || "").trim()
      );
      if (isResolvableCourseStepThumbUrl(uploaded)) {
        return { ...list, cover_image_url: uploaded };
      }

      const url = await resolveCourseStepThumbUrl(
        {
          place_id: first.place_id,
          name: first.name,
          address: first.address,
          lat: first.lat,
          lng: first.lng,
          kakao_place_id: first.kakao_place_id,
          image_url: first.image_url,
        },
        { skipGoogleFallback: true }
      );
      return url ? { ...list, cover_image_url: url } : list;
    })
  );
}
