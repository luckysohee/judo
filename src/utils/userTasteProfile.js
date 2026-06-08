/**
 * 가입 설문·user_taste_preferences → 장소 룰 스코어 (LLM 없음)
 */

import { STUDIO_ATMOSPHERE_OPTIONS, STUDIO_LIQUOR_TYPE_OPTIONS } from "./placeTaxonomy.js";

export const TASTE_SITUATION_OPTIONS = [
  { value: "date", label: "💑 데이트" },
  { value: "group", label: "👥 회식·모임" },
  { value: "solo", label: "🧘 혼술" },
  { value: "friends", label: "🍻 친구와" },
];

export const TASTE_PARTY_SIZE_OPTIONS = [
  { value: 1, label: "혼자 (1명)" },
  { value: 2, label: "둘이 (2명)" },
  { value: 4, label: "소규모 (3~4명)" },
  { value: 6, label: "회식 (5명+)" },
];

export const TASTE_REGION_OPTIONS = [
  "홍대",
  "합정",
  "연남",
  "성수",
  "강남",
  "을지로",
  "종로",
  "이태원",
  "망원",
  "기타",
];

const LIQUOR_EMOJI = {
  소주: "🍶",
  맥주: "🍺",
  와인: "🍷",
  하이볼: "🥃",
  칵테일: "🍹",
  전통주: "🍾",
  막걸리: "🍶",
  사케: "🍶",
  위스키: "🥃",
  고량주: "🍶",
};

function normList(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((s) => String(s || "").trim()).filter(Boolean))];
}

function blob(place) {
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
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * @param {Record<string, unknown>} answers — OnboardingAnswers
 * @returns {import('../api/userTastePreferences.js').UserTastePreferencesRow}
 */
export function tasteRowFromOnboardingAnswers(answers, userId, status = "completed") {
  const a = answers && typeof answers === "object" ? answers : {};
  const liquor = normList(a.liquor_types);
  const vibes = normList(a.vibes);
  const regions = normList(a.regions);
  const situations = a.situation ? [String(a.situation)] : normList(a.situations);
  let partySize = null;
  const ps = Number(a.party_size);
  if (Number.isFinite(ps) && ps > 0) partySize = Math.round(ps);

  const empty =
    !liquor.length &&
    !vibes.length &&
    !regions.length &&
    !situations.length &&
    partySize == null &&
    !a.prefer_walkable;

  return {
    user_id: userId,
    liquor_types: liquor,
    vibes: vibes,
    situations,
    regions,
    party_size: partySize,
    prefer_walkable: Boolean(a.prefer_walkable),
    onboarding_status: empty && status === "completed" ? "skipped" : status,
  };
}

/**
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null|undefined} row
 */
export function tasteProfileHasSignals(row) {
  if (!row || row.onboarding_status === "pending") return false;
  return (
    (Array.isArray(row.liquor_types) && row.liquor_types.length > 0) ||
    (Array.isArray(row.vibes) && row.vibes.length > 0) ||
    (Array.isArray(row.regions) && row.regions.length > 0) ||
    (Array.isArray(row.situations) && row.situations.length > 0) ||
    (row.party_size != null && row.party_size > 0)
  );
}

/**
 * @param {object} place
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null|undefined} profile
 * @returns {number}
 */
export function scorePlaceWithTasteProfile(place, profile) {
  if (!place || !tasteProfileHasSignals(profile)) return 0;

  const text = blob(place);
  let score = 0;

  for (const l of profile.liquor_types || []) {
    if (text.includes(String(l).toLowerCase())) score += 14;
  }
  for (const v of profile.vibes || []) {
    const v0 = String(v).toLowerCase();
    if (text.includes(v0) || text.includes(v0.replace(/한$/, ""))) score += 12;
  }
  for (const r of profile.regions || []) {
    if (r === "기타") continue;
    if (text.includes(String(r).toLowerCase())) score += 16;
  }

  const situationTags = {
    date: ["데이트", "로맨틱", "와인", "분위기"],
    group: ["회식", "단체", "모임", "고깃", "한식"],
    solo: ["혼술", "혼자", "조용", "바"],
    friends: ["친구", "포차", "맥주", "시끌"],
  };
  for (const s of profile.situations || []) {
    const hints = situationTags[s] || [];
    for (const h of hints) {
      if (text.includes(h.toLowerCase())) score += 6;
    }
  }

  if (profile.party_size === 1 && /혼술|바|조용/.test(text)) score += 8;
  if (profile.party_size === 2 && /데이트|로맨틱|와인바/.test(text)) score += 8;
  if (profile.party_size >= 5 && /회식|고깃|한식|포장마차/.test(text)) score += 8;

  if (profile.prefer_walkable) score += 2;

  return score;
}

/**
 * @param {object[]} places
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null|undefined} profile
 * @param {{ limit?: number }} [opts]
 */
export function pickTodayTastePlaces(places, profile, opts = {}) {
  const limit = Math.max(1, Math.min(5, Number(opts.limit) || 3));
  const list = Array.isArray(places) ? places : [];
  if (!list.length || !tasteProfileHasSignals(profile)) return [];

  const ranked = list
    .map((p) => ({ p, score: scorePlaceWithTasteProfile(p, profile) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return list.slice(0, Math.min(limit, 3));
  }

  return ranked.slice(0, limit).map((x) => x.p);
}

/** 코스·2차 찾기 모달 기본값 */
export function tasteProfileToSecondFindDefaults(profile) {
  if (!profile) {
    return { vibes: [], liquorTypes: [], preferCloser: false };
  }
  return {
    vibes: [...(profile.vibes || [])].slice(0, 4),
    liquorTypes: [...(profile.liquor_types || [])].slice(0, 3),
    preferCloser: Boolean(profile.prefer_walkable),
  };
}

export function liquorOptionsForOnboarding() {
  return STUDIO_LIQUOR_TYPE_OPTIONS.map((value) => ({
    value,
    label: `${LIQUOR_EMOJI[value] || "🍷"} ${value}`,
  }));
}

export function vibeOptionsForOnboarding() {
  return STUDIO_ATMOSPHERE_OPTIONS.slice(0, 10).map((value) => ({
    value,
    label: value,
  }));
}
