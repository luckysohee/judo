/**
 * 개인 맞춤 "오늘 여기" 추천 — 룰 기반(LLM 없음).
 *
 * 합산 점수 = 설문 취향 + 검색 이력 + 픽한 큐레이터 보너스.
 * 각 픽에 "왜 추천하는지" 한 줄 이유를 붙인다.
 */

import {
  scorePlaceWithTasteProfile,
  tasteProfileHasSignals,
} from "./userTasteProfile.js";

const PICKED_CURATOR_BONUS = 22;

function placeText(place) {
  return [
    place?.name,
    place?.place_name,
    place?.category,
    place?.category_name,
    place?.address,
    place?.address_name,
    place?.road_address_name,
    ...(Array.isArray(place?.tags) ? place.tags : []),
    ...(Array.isArray(place?.moods) ? place.moods : []),
    ...(Array.isArray(place?.vibes) ? place.vibes : []),
    ...(Array.isArray(place?.liquor_types) ? place.liquor_types : []),
    place?.alcohol_type,
    place?.atmosphere,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function topMatch(text, entries, limitCount = 3) {
  if (!Array.isArray(entries)) return null;
  for (const e of entries.slice(0, limitCount)) {
    const v = String(e?.value || "").trim();
    if (v && text.includes(v.toLowerCase())) return v;
  }
  return null;
}

/**
 * 검색 이력 신호로 장소 점수화 (빈도 상위 신호일수록 가중).
 * @returns {{score:number, matched:{region?:string, liquor?:string, vibe?:string}}}
 */
export function scorePlaceWithSearchSignals(place, signals) {
  if (!place || !signals) return { score: 0, matched: {} };
  const text = placeText(place);
  let score = 0;
  const matched = {};

  const apply = (entries, perWeight, key) => {
    if (!Array.isArray(entries)) return;
    entries.forEach((e, idx) => {
      const v = String(e?.value || "").trim();
      if (!v || v === "기타") return;
      if (text.includes(v.toLowerCase())) {
        const rankWeight = idx === 0 ? 1.5 : idx <= 2 ? 1.2 : 1;
        const freqWeight = Math.min(Number(e?.count) || 1, 4);
        score += perWeight * rankWeight * Math.min(freqWeight, 4);
        if (!matched[key]) matched[key] = v;
      }
    });
  };

  apply(signals.regions, 5, "region");
  apply(signals.liquor, 4, "liquor");
  apply(signals.vibes, 3, "vibe");

  return { score: Math.round(score), matched };
}

function placeIdKey(place) {
  const id = place?.id ?? place?.place_id ?? null;
  return id != null ? String(id).trim() : "";
}

/**
 * 추천 이유 한 줄 생성.
 * @returns {string}
 */
export function buildRecommendReason({ searchMatched, pickedCurator, profile, place }) {
  const parts = [];

  const sm = searchMatched || {};
  const searchBits = [sm.region, sm.liquor, sm.vibe].filter(Boolean);
  if (searchBits.length > 0) {
    parts.push(`${searchBits.slice(0, 2).join("·")} 자주 찾으심`);
  }

  if (pickedCurator) {
    const handle = String(pickedCurator.handle || "").trim();
    const name = String(pickedCurator.name || "").trim();
    if (handle) parts.push(`@${handle} 픽`);
    else if (name) parts.push(`${name} 픽`);
    else parts.push("픽한 큐레이터");
  }

  if (parts.length === 0 && tasteProfileHasSignals(profile)) {
    const text = placeText(place);
    const r =
      topMatch(text, (profile.regions || []).map((value) => ({ value }))) ||
      null;
    const l =
      topMatch(text, (profile.liquor_types || []).map((value) => ({ value }))) ||
      null;
    const bits = [r, l].filter(Boolean);
    if (bits.length > 0) parts.push(`${bits.join("·")} 취향`);
    else parts.push("취향에 맞는 곳");
  }

  if (parts.length === 0) parts.push("내 취향에 맞는 곳");
  return parts.join(" · ");
}

/**
 * 설문 + 검색 + 픽 큐레이터를 합산해 상위 장소 추천.
 *
 * @param {object[]} places 후보 장소 (보통 지도에 보이는 displayedPlaces)
 * @param {object} ctx
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null} ctx.profile 설문 취향
 * @param {ReturnType<import('./userSearchTasteSignals.js').aggregateSearchTasteSignals>|null} ctx.searchSignals
 * @param {Set<string>|null} ctx.pickedPlaceIds
 * @param {Map<string,{handle:string,name:string}>|null} ctx.pickedPlaceInfo
 * @param {{limit?:number}} [opts]
 * @returns {Array<object>} 각 장소에 `_recommendReason` 부여
 */
export function pickPersonalTastePlaces(places, ctx = {}, opts = {}) {
  const limit = Math.max(1, Math.min(5, Number(opts.limit) || 3));
  const list = Array.isArray(places) ? places : [];
  if (!list.length) return [];

  const {
    profile = null,
    searchSignals = null,
    pickedPlaceIds = null,
    pickedPlaceInfo = null,
  } = ctx;

  const hasProfile = tasteProfileHasSignals(profile);
  const hasSearch =
    searchSignals &&
    ((searchSignals.regions && searchSignals.regions.length) ||
      (searchSignals.liquor && searchSignals.liquor.length) ||
      (searchSignals.vibes && searchSignals.vibes.length));
  const hasPicked = pickedPlaceIds && pickedPlaceIds.size > 0;

  if (!hasProfile && !hasSearch && !hasPicked) return [];

  const ranked = list
    .map((place) => {
      const onboardingScore = hasProfile
        ? scorePlaceWithTasteProfile(place, profile)
        : 0;
      const search = hasSearch
        ? scorePlaceWithSearchSignals(place, searchSignals)
        : { score: 0, matched: {} };

      const key = placeIdKey(place);
      const isPicked = hasPicked && key && pickedPlaceIds.has(key);
      const pickedCurator =
        isPicked && pickedPlaceInfo ? pickedPlaceInfo.get(key) || null : null;
      const pickedScore = isPicked ? PICKED_CURATOR_BONUS : 0;

      const total = onboardingScore + search.score + pickedScore;
      return {
        place,
        total,
        searchMatched: search.matched,
        pickedCurator,
      };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  if (!ranked.length) return [];

  return ranked.slice(0, limit).map((x) => ({
    ...x.place,
    _recommendReason: buildRecommendReason({
      searchMatched: x.searchMatched,
      pickedCurator: x.pickedCurator,
      profile,
      place: x.place,
    }),
  }));
}
