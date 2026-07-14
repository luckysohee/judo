/**
 * 가입 설문·user_taste_preferences → 장소 룰 스코어 (LLM 없음)
 */

import {
  STUDIO_ATMOSPHERE_OPTIONS,
  STUDIO_LIQUOR_TYPE_OPTIONS,
  mapStudioVibesToSecondFindDefaults,
} from "./placeTaxonomy.js";
import { curatorMetaTextForTasteBlob } from "./curatorPlaceMetaLift.js";

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
  "압구정",
  "청담",
  "잠실",
  "문정",
  "을지로",
  "종로",
  "이태원",
  "망원",
  "기타",
];

const TASTE_REGION_PRESET_SET = new Set(
  TASTE_REGION_OPTIONS.filter((r) => r !== "기타")
);

/**
 * 설문 「그 외」직접 입력 → regions 배열에 실동네명으로 합침.
 * @param {Record<string, unknown>} answers
 * @returns {string[]}
 */
export function resolveOnboardingRegions(answers) {
  const a = answers && typeof answers === "object" ? answers : {};
  const selected = normList(a.regions);
  const otherRaw = String(a.regions_other ?? "").trim();
  const otherParts = otherRaw
    ? otherRaw
        .split(/[,，、/|]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const out = [];
  const seen = new Set();
  const push = (v) => {
    const s = String(v || "").trim();
    if (!s || s === "기타" || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  for (const r of selected) {
    if (r === "기타") continue;
    push(r);
  }
  for (const o of otherParts) push(o);

  /** 「그 외」만 골랐는데 입력이 없으면 빈 배열 — 진행 불가 처리는 UI */
  return out;
}

/** 음주·외출 빈도 */
export const TASTE_DRINK_FREQUENCY_OPTIONS = [
  { value: "rarely", label: "🌙 거의 안 마셔요" },
  { value: "monthly", label: "📅 한 달 1~2번" },
  { value: "biweekly", label: "🗓️ 2~3주에 한 번" },
  { value: "weekly", label: "🍻 일주일 1번 정도" },
  { value: "multi_weekly", label: "🔥 일주일에 여러 번" },
];

/** 주량·술 잘 받는 정도 */
export const TASTE_DRINK_CAPACITY_OPTIONS = [
  { value: "light", label: "💧 가볍게 (1~2잔)" },
  { value: "moderate", label: "🍺 보통 (2~4잔)" },
  { value: "heavy", label: "🥃 잘 마셔요" },
  { value: "varies", label: "🎲 그날마다 달라요" },
];

/** 1인당 술자리 예산 (원) */
export const TASTE_BUDGET_OPTIONS = [
  { value: "under_30k", label: "💵 3만 원 이하" },
  { value: "30_50k", label: "💵 3~5만 원" },
  { value: "50_80k", label: "💵 5~8만 원" },
  { value: "80k_plus", label: "💎 8만 원 이상" },
];

/** 1차 시작 시간대 */
export const TASTE_OUT_TIME_OPTIONS = [
  { value: "morning", label: "🌅 아침·브런치 (10~12시)" },
  { value: "daytime", label: "☀️ 낮·점심 (12~17시)" },
  { value: "early", label: "🌆 저녁 일찍 (18~20시)" },
  { value: "prime", label: "🌃 본격 술자리 (20~23시)" },
  { value: "late", label: "🦉 늦게 (23시~)" },
  { value: "flexible", label: "⏰ 상황마다 달라요" },
];

/** 안주·식사 스타일 */
export const TASTE_ANJU_STYLE_OPTIONS = [
  { value: "meal", label: "🍽️ 밥·안주 제대로" },
  { value: "light", label: "🥜 가볍게 안주만" },
  { value: "share_plate", label: "🫕 같이 나눠 먹기" },
  { value: "dessert_after", label: "🍰 2차는 디저트·카페" },
  { value: "bar_snack", label: "🍺 바 스낵 위주" },
];

const TASTE_OPTION_LABELS = {
  drink_frequency: TASTE_DRINK_FREQUENCY_OPTIONS,
  drink_capacity: TASTE_DRINK_CAPACITY_OPTIONS,
  budget_per_person: TASTE_BUDGET_OPTIONS,
  out_time: TASTE_OUT_TIME_OPTIONS,
  anju_styles: TASTE_ANJU_STYLE_OPTIONS,
};

function labelForTasteValue(field, value) {
  const opts = TASTE_OPTION_LABELS[field];
  if (!opts) return String(value ?? "");
  const hit = opts.find((o) => o.value === value);
  return hit?.label?.replace(/^[^\s]+\s/, "") || String(value ?? "");
}

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
    place?.one_line_review,
    place?.recommended_menu,
    place?.menu_reason,
    place?.price_range,
    place?.atmosphere,
    ...(Array.isArray(place?.visit_situations) ? place.visit_situations : []),
    ...(Array.isArray(place?.tags) ? place.tags : []),
    ...(Array.isArray(place?.moods) ? place.moods : []),
    ...(Array.isArray(place?.vibes) ? place.vibes : []),
    ...(Array.isArray(place?.liquor_types) ? place.liquor_types : []),
    ...(Array.isArray(place?.alcohol_types) ? place.alcohol_types : []),
    curatorMetaTextForTasteBlob(place),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow} profile
 * @param {object} place
 * @param {{ skipRegion?: boolean, halfLiquor?: boolean }} [opts]
 * @returns {{ raw: number, matched: Record<string, string> }}
 */
function computeTasteProfileMatch(profile, place, opts = {}) {
  const text = blob(place);
  let raw = 0;
  /** @type {Record<string, string>} */
  const matched = {};
  const liquorPts = opts.halfLiquor ? 7 : 14;

  for (const l of profile.liquor_types || []) {
    if (text.includes(String(l).toLowerCase())) {
      raw += liquorPts;
      if (!matched.liquor) matched.liquor = String(l);
    }
  }
  if (!opts.skipRegion) {
    for (const r of profile.regions || []) {
      if (r === "기타") continue;
      if (text.includes(String(r).toLowerCase())) {
        raw += 16;
        if (!matched.region) matched.region = String(r);
      }
    }
  }

  for (const v of profile.vibes || []) {
    const v0 = String(v).toLowerCase();
    if (text.includes(v0) || text.includes(v0.replace(/한$/, ""))) {
      raw += 12;
      if (!matched.vibe) matched.vibe = String(v);
    }
  }

  const situationTags = {
    date: ["데이트", "로맨틱", "와인", "분위기"],
    group: ["회식", "단체", "모임", "고깃", "한식"],
    solo: ["혼술", "혼자", "조용", "바"],
    friends: ["친구", "포차", "맥주", "시끌"],
  };
  const situationLabels = Object.fromEntries(
    TASTE_SITUATION_OPTIONS.map((o) => [o.value, o.label.replace(/^[^\s]+\s/, "")])
  );
  for (const s of profile.situations || []) {
    const hints = situationTags[s] || [];
    for (const h of hints) {
      if (text.includes(h.toLowerCase())) {
        raw += 6;
        if (!matched.situation) {
          matched.situation = situationLabels[s] || String(s);
        }
        break;
      }
    }
  }

  if (profile.party_size === 1 && /혼술|바|조용/.test(text)) raw += 8;
  if (profile.party_size === 2 && /데이트|로맨틱|와인바/.test(text)) raw += 8;
  if (profile.party_size >= 5 && /회식|고깃|한식|포장마차/.test(text)) raw += 8;

  if (profile.prefer_walkable) raw += 2;

  if (profile.budget_per_person === "under_30k" && /포차|맥주|저렴/.test(text)) {
    raw += 6;
    if (!matched.budget) matched.budget = "가성비";
  }
  if (profile.budget_per_person === "30_50k" && /포차|맥주|이자카야|펍/.test(text)) {
    raw += 5;
  }
  if (
    profile.budget_per_person === "80k_plus" &&
    /와인|프렌치|오마카세|파인|프리미엄/.test(text)
  ) {
    raw += 8;
    if (!matched.budget) matched.budget = "프리미엄";
  }
  for (const a of profile.anju_styles || []) {
    if (a === "meal" && /한식|고깃|식사|백반/.test(text)) raw += 5;
    if (a === "dessert_after" && /디저트|카페|빵/.test(text)) raw += 5;
    if (a === "bar_snack" && /바|펍|맥주/.test(text)) raw += 4;
  }

  if (profile.drink_capacity === "light" && /가벼|1잔|저알콜|하이볼/.test(text)) {
    raw += 4;
  }
  if (
    profile.drink_capacity === "heavy" &&
    /위스키|칵테일|맥주|호프|술집/.test(text)
  ) {
    raw += 4;
  }

  return { raw, matched };
}

/**
 * 홈 검색 랭킹용 — raw 취향 점수를 cap·scale 해서 쿼리 facet과 균형 맞춤.
 *
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null|undefined} profile
 * @param {object} place — `evidencePlace` (큐레이터 merge 후) 권장
 * @param {{ queryHasExplicitRegion?: boolean, queryHasExplicitAlcohol?: boolean, cap?: number }} [opts]
 * @returns {{ raw: number, boost: number, matched: Record<string, string> }}
 */
export function scoreTasteProfileForSearch(profile, place, opts = {}) {
  if (!place || !tasteProfileHasSignals(profile)) {
    return { raw: 0, boost: 0, matched: {} };
  }

  const { raw, matched } = computeTasteProfileMatch(profile, place, {
    skipRegion: Boolean(opts.queryHasExplicitRegion),
    halfLiquor: Boolean(opts.queryHasExplicitAlcohol),
  });
  const cap = Number.isFinite(Number(opts.cap)) ? Number(opts.cap) : 28;
  const boost = raw > 0 ? Math.min(Math.round(raw * 0.35), cap) : 0;
  return { raw, boost, matched };
}

/**
 * @param {Record<string, string>|null|undefined} matched
 * @returns {string|null}
 */
export function buildTasteMatchReasonLine(matched) {
  if (!matched || typeof matched !== "object") return null;
  const bits = [matched.region, matched.liquor, matched.vibe, matched.situation]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!bits.length) return null;
  return `${bits.slice(0, 2).join(" · ")} 취향에 맞아요`;
}

/**
 * @param {Record<string, unknown>} answers — OnboardingAnswers
 * @returns {import('../api/userTastePreferences.js').UserTastePreferencesRow}
 */
export function tasteRowFromOnboardingAnswers(answers, userId, status = "completed") {
  const a = answers && typeof answers === "object" ? answers : {};
  const liquor = normList(a.liquor_types);
  const vibes = normList(a.vibes);
  const regions = resolveOnboardingRegions(a);
  const situations = a.situation ? [String(a.situation)] : normList(a.situations);
  let partySize = null;
  const ps = Number(a.party_size);
  if (Number.isFinite(ps) && ps > 0) partySize = Math.round(ps);

  const drinkFrequency = String(a.drink_frequency || "").trim() || null;
  const drinkCapacity = String(a.drink_capacity || "").trim() || null;
  const budgetPerPerson = String(a.budget_per_person || "").trim() || null;
  const outTime = String(a.out_time || "").trim() || null;
  const anjuStyles = normList(a.anju_styles);

  const empty =
    !liquor.length &&
    !vibes.length &&
    !regions.length &&
    !situations.length &&
    partySize == null &&
    !a.prefer_walkable &&
    !drinkFrequency &&
    !drinkCapacity &&
    !budgetPerPerson &&
    !outTime &&
    !anjuStyles.length;

  return {
    user_id: userId,
    liquor_types: liquor,
    vibes: vibes,
    situations,
    regions,
    party_size: partySize,
    prefer_walkable: Boolean(a.prefer_walkable),
    drink_frequency: drinkFrequency,
    drink_capacity: drinkCapacity,
    budget_per_person: budgetPerPerson,
    out_time: outTime,
    anju_styles: anjuStyles,
    onboarding_status: empty && status === "completed" ? "skipped" : status,
  };
}

/**
 * DB 행 → OnboardingQuestions 초기값
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null|undefined} row
 */
export function tasteRowToOnboardingAnswers(row) {
  if (!row) return {};
  /** @type {Record<string, unknown>} */
  const answers = {};
  if (Array.isArray(row.liquor_types) && row.liquor_types.length) {
    answers.liquor_types = [...row.liquor_types];
  }
  if (Array.isArray(row.vibes) && row.vibes.length) {
    answers.vibes = [...row.vibes];
  }
  if (Array.isArray(row.situations) && row.situations.length) {
    answers.situation = row.situations[0];
  }
  if (row.party_size != null && row.party_size > 0) {
    answers.party_size = row.party_size;
  }
  if (Array.isArray(row.regions) && row.regions.length) {
    const preset = [];
    const custom = [];
    for (const r of row.regions) {
      const s = String(r || "").trim();
      if (!s || s === "기타") continue;
      if (TASTE_REGION_PRESET_SET.has(s)) preset.push(s);
      else custom.push(s);
    }
    answers.regions = custom.length ? [...preset, "기타"] : [...preset];
    if (custom.length) {
      answers.regions_other = custom.join(", ");
    }
  }
  if (row.onboarding_status === "completed") {
    answers.prefer_walkable = row.prefer_walkable ? "yes" : "no";
  }
  if (row.drink_frequency) answers.drink_frequency = row.drink_frequency;
  if (row.drink_capacity) answers.drink_capacity = row.drink_capacity;
  if (row.budget_per_person) answers.budget_per_person = row.budget_per_person;
  if (row.out_time) answers.out_time = row.out_time;
  if (Array.isArray(row.anju_styles) && row.anju_styles.length) {
    answers.anju_styles = [...row.anju_styles];
  }
  return answers;
}

/**
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null|undefined} row
 * @returns {{ label: string, value: string }[]}
 */
export function formatTasteProfileSummary(row) {
  if (!row || !tasteProfileHasSignals(row)) return [];

  /** @type {{ label: string, value: string }[]} */
  const parts = [];

  if (row.liquor_types?.length) {
    parts.push({ label: "술", value: row.liquor_types.join(" · ") });
  }
  if (row.drink_frequency) {
    parts.push({
      label: "빈도",
      value: labelForTasteValue("drink_frequency", row.drink_frequency),
    });
  }
  if (row.drink_capacity) {
    parts.push({
      label: "주량",
      value: labelForTasteValue("drink_capacity", row.drink_capacity),
    });
  }
  if (row.vibes?.length) {
    parts.push({ label: "분위기", value: row.vibes.join(" · ") });
  }
  const situationLabel = TASTE_SITUATION_OPTIONS.find(
    (o) => o.value === row.situations?.[0]
  )?.label;
  if (situationLabel) {
    parts.push({ label: "상황", value: situationLabel.replace(/^[^\s]+\s/, "") });
  }
  const partyLabel = TASTE_PARTY_SIZE_OPTIONS.find(
    (o) => o.value === row.party_size
  )?.label;
  if (partyLabel) {
    parts.push({ label: "인원", value: partyLabel });
  }
  if (row.regions?.length) {
    parts.push({ label: "동네", value: row.regions.join(" · ") });
  }
  if (row.budget_per_person) {
    parts.push({
      label: "예산",
      value: labelForTasteValue("budget_per_person", row.budget_per_person),
    });
  }
  if (row.out_time) {
    parts.push({
      label: "1차",
      value: labelForTasteValue("out_time", row.out_time),
    });
  }
  if (row.anju_styles?.length) {
    parts.push({
      label: "안주",
      value: row.anju_styles
        .map((v) => labelForTasteValue("anju_styles", v))
        .join(" · "),
    });
  }
  if (row.onboarding_status === "completed") {
    parts.push({
      label: "1·2차",
      value: row.prefer_walkable ? "걸어서 갈 수 있는 곳" : "거리 상관없음",
    });
  }

  return parts;
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
    (row.party_size != null && row.party_size > 0) ||
    Boolean(row.drink_frequency) ||
    Boolean(row.drink_capacity) ||
    Boolean(row.budget_per_person) ||
    Boolean(row.out_time) ||
    (Array.isArray(row.anju_styles) && row.anju_styles.length > 0)
  );
}

/**
 * @param {object} place
 * @param {import('../api/userTastePreferences.js').UserTastePreferencesRow|null|undefined} profile
 * @returns {number}
 */
export function scorePlaceWithTasteProfile(place, profile) {
  if (!place || !tasteProfileHasSignals(profile)) return 0;
  return computeTasteProfileMatch(profile, place).raw;
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
  // 레거시·세분 분위기 → 공통 축(활기찬/모던함/힙한/…)으로 접기
  return {
    vibes: mapStudioVibesToSecondFindDefaults(profile.vibes || []),
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
  return STUDIO_ATMOSPHERE_OPTIONS.map((value) => ({
    value,
    label: value,
  }));
}

/** @returns {Array<{ id: string, question: string, subtitle?: string, type: 'single'|'multiple', options: {value: string|number, label: string}[] }>} */
export function buildTasteOnboardingQuestions() {
  return [
    {
      id: "liquor_types",
      question: "어떤 술을 즐겨 마시나요?",
      subtitle: "복수 선택 가능",
      type: "multiple",
      options: liquorOptionsForOnboarding(),
    },
    {
      id: "drink_frequency",
      question: "얼마나 자주 술자리가 있나요?",
      type: "single",
      options: TASTE_DRINK_FREQUENCY_OPTIONS,
    },
    {
      id: "drink_capacity",
      question: "평소 주량은 어느 정도인가요?",
      subtitle: "맞춤 코스·2차 추천에 참고해요",
      type: "single",
      options: TASTE_DRINK_CAPACITY_OPTIONS,
    },
    {
      id: "vibes",
      question: "어떤 분위기를 좋아하나요?",
      subtitle: "복수 선택 가능",
      type: "multiple",
      options: vibeOptionsForOnboarding(),
    },
    {
      id: "anju_styles",
      question: "안주·식사 스타일은?",
      subtitle: "복수 선택 가능",
      type: "multiple",
      options: TASTE_ANJU_STYLE_OPTIONS,
    },
    {
      id: "situation",
      question: "보통 어떤 상황으로 나가시나요?",
      type: "single",
      options: TASTE_SITUATION_OPTIONS,
    },
    {
      id: "party_size",
      question: "보통 몇 명이서 가시나요?",
      type: "single",
      options: TASTE_PARTY_SIZE_OPTIONS,
    },
    {
      id: "regions",
      question: "자주 가는 동네는 어디인가요?",
      subtitle: "복수 선택 가능",
      type: "multiple",
      options: TASTE_REGION_OPTIONS.map((value) => ({
        value,
        label: value === "기타" ? "📍 그 외" : `📍 ${value}`,
      })),
    },
    {
      id: "budget_per_person",
      question: "1인당 보통 예산은?",
      subtitle: "술·안주 포함 대략적 금액",
      type: "single",
      options: TASTE_BUDGET_OPTIONS,
    },
    {
      id: "out_time",
      question: "1차는 보통 몇 시쯤 시작하나요?",
      subtitle: "첫 잔·첫 술집 기준",
      type: "single",
      options: TASTE_OUT_TIME_OPTIONS,
    },
    {
      id: "prefer_walkable",
      question: "1·2차는 걸어서 갈 수 있는 곳이 좋나요?",
      type: "single",
      options: [
        { value: "yes", label: "🚶 네, 가까운 곳 위주" },
        { value: "no", label: "🚕 거리는 상관없어요" },
      ],
    },
  ];
}
