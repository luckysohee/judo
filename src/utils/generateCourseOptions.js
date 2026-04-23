import { COURSE_PATTERNS } from "./coursePatterns.js";
import { COURSE_PROFILE_ORDER, COURSE_PROFILES } from "./courseProfiles.js";
import { haversineMeters, resolvePlaceWgs84 } from "./placeCoords.js";
import { REGION_KEYWORDS } from "./searchParser.js";
import { getMinutesUntilClose, isPlaceOpenNow } from "./timeUtils.js";

function hashString(s) {
  let h = 5381;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/** 0..1 유사 균등 — 검색마다·프로필마다 다른 코스 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleHeadInCopy(arr, headLen, rng) {
  const out = [...arr];
  const n = Math.min(headLen, out.length);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)];
}

function tokensFromCategoryName(place) {
  const cn = place?.category_name;
  if (!cn || typeof cn !== "string") return [];
  return cn
    .split(/[>,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function placeCategories(place) {
  const fromArr = normalizeArray(place.categories);
  const fromCat = tokensFromCategoryName(place);
  return [...new Set([...fromArr, ...fromCat])];
}

function placeAreaHaystack(place) {
  return [
    place.areaName,
    place.region,
    place.address_name,
    place.road_address_name,
    place.address,
    place.place_name,
    place.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** 을지로 코스: 주소에 이 구가 있으면 상호만 «을지로»여도 제외(용산·영등포 등 오탐 방지) */
const EULJIRO_EXCLUDED_GU_MARKERS = [
  "성동구",
  "광진구",
  "강남구",
  "서초구",
  "송파구",
  "강동구",
  "마포구",
  "영등포구",
  "양천구",
  "구로구",
  "용산구",
];

function placeMatchesArea(place, areaKey) {
  if (!areaKey) return true;
  const blob = placeAreaHaystack(place);
  const synonyms = REGION_KEYWORDS[areaKey];
  const matched = synonyms?.length
    ? synonyms.some((s) => blob.includes(String(s).toLowerCase()))
    : blob.includes(String(areaKey).toLowerCase());
  if (!matched) return false;
  if (areaKey === "을지로") {
    const b = blob.toLowerCase();
    if (
      EULJIRO_EXCLUDED_GU_MARKERS.some((g) =>
        b.includes(String(g).toLowerCase())
      )
    ) {
      return false;
    }
  }
  return true;
}

function includesAny(source, target) {
  if (!source.length || !target.length) return false;
  const set = new Set(source.map((x) => String(x).toLowerCase()));
  return target.some((t) => set.has(String(t).toLowerCase()));
}

/**
 * 코스 룰의 category 토큰(포차·해산물 등)과 장소 매칭.
 * 카카오 `음식점 > 포장마차`, `횟집` 등은 완전일치만으로는 누락되므로 동의어·부분문자열 사용.
 */
const RULE_CATEGORY_NEEDLES = {
  포차: ["포차", "포장마차", "포장"],
  술집: ["술집", "주점", "호프", "노가리"],
  해산물: [
    "해산물",
    "횟집",
    "생선회",
    "모둠회",
    "물회",
    "회덮밥",
    "해물",
    "조개",
    "새우",
    "낙지",
    "문어",
    "게장",
    "회집",
    "사시미",
    "오마카세",
    "스시",
    "초밥",
    "활어",
    "수산",
  ],
  이자카야: ["이자카야"],
  와인바: ["와인바", "와인"],
  바: ["pub", "펍", "칵테일", "칵테일바", "와이드바"],
  한식: ["한식", "한정식", "백반"],
  고깃집: ["고깃집", "삼겹살", "갈비", "육류", "고기"],
  식사: ["식사", "음식점", "식당", "레스토랑"],
  육류: ["육류", "고기", "삼겹살", "갈비", "스테이크"],
  고기: ["고기", "고깃집", "삼겹살", "갈비", "육류"],
  양식: ["양식", "이탈리", "프렌치", "파스타", "스테이크"],
  다이닝: ["다이닝", "파인", "코스"],
  카페: ["카페", "커피"],
  디저트: [
    "디저트",
    "아이스크림",
    "젤라또",
    "gelato",
    "빙수",
    "팥빙수",
    "케이크",
    "도넛",
    "도너츠",
    "베이커리",
    "초콜릿",
    "브레드",
    "빵",
  ],
  칵테일: ["칵테일", "칵테일바"],
};

function coursePlaceMatchesRuleCategories(place, ruleCategories) {
  if (!Array.isArray(ruleCategories) || !ruleCategories.length) return false;
  const tokens = placeCategories(place).map((c) => String(c).toLowerCase());
  const catHay = [...tokens, String(place.category_name || "").toLowerCase()]
    .join(" ")
    .trim();
  const nameHay = `${String(place.name || "").toLowerCase()} ${String(
    place.place_name || ""
  ).toLowerCase()}`.trim();
  const fullHay = `${catHay} ${nameHay}`;

  for (const rc of ruleCategories) {
    const rcl = String(rc).toLowerCase();
    if (includesAny(placeCategories(place), [rc])) return true;

    if (rcl === "바") {
      if (tokens.includes("바")) return true;
      if (
        fullHay.includes("pub") ||
        fullHay.includes("펍") ||
        fullHay.includes("칵테일")
      ) {
        return true;
      }
      continue;
    }

    const needles = RULE_CATEGORY_NEEDLES[rcl] || [rc];
    for (const n of needles) {
      const nl = String(n).toLowerCase();
      if (!nl) continue;
      if (nl.length <= 2) {
        if (catHay.includes(nl)) return true;
      } else if (fullHay.includes(nl)) return true;
    }
  }
  return false;
}

function countMatches(source, target) {
  if (!source.length || !target.length) return 0;
  const set = new Set(target.map((t) => String(t).toLowerCase()));
  return source.filter((item) => set.has(String(item).toLowerCase())).length;
}

export function placeId(place) {
  if (!place || typeof place !== "object") return null;
  return place.id ?? place.place_id ?? place.kakao_place_id ?? null;
}

/** 카카오 숫자 장소 id (DB·정규화 행 중복 구분) */
function kakaoVenueId(place) {
  if (!place || typeof place !== "object") return null;
  const raw = place._raw && typeof place._raw === "object" ? place._raw : null;
  const k =
    place.kakao_place_id ??
    place.kakaoId ??
    raw?.kakao_place_id ??
    raw?.kakaoId ??
    null;
  if (k == null || k === "") return null;
  const s = String(k).trim();
  return /^\d+$/.test(s) ? s : null;
}

function normalizePlaceName(place) {
  return String(place?.name || place?.place_name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** 코스 1차≠2차: id·카카오id·(이름+초근접) 동일 제외 + 최소 거리 */
const SECOND_MIN_DISTANCE_METERS = 35;
const SAME_NAME_MAX_DISTANCE_METERS = 80;

export function isSameVenueForCourseStep(first, second) {
  const id1 = placeId(first);
  const id2 = placeId(second);
  if (id1 != null && id2 != null && String(id1) === String(id2)) {
    return true;
  }

  const k1 = kakaoVenueId(first);
  const k2 = kakaoVenueId(second);
  if (k1 && k2 && k1 === k2) return true;

  const d = haversineMeters(
    Number(first.lat),
    Number(first.lng),
    Number(second.lat),
    Number(second.lng)
  );
  if (!Number.isFinite(d)) return true;

  const n1 = normalizePlaceName(first);
  const n2 = normalizePlaceName(second);
  if (n1 && n2 && n1 === n2 && d < SAME_NAME_MAX_DISTANCE_METERS) {
    return true;
  }

  return false;
}

/** 1차·2차(또는 1·쩜오차·2) 장소 id 조합 (프로필 무관 — 이미 본 조합 제외용) */
export function courseVenuePairKey(course) {
  const steps = course?.steps || [];
  if (steps.length >= 3) {
    const ids = steps
      .map((s) => placeId(s?.place))
      .filter((x) => x != null)
      .map(String);
    if (ids.length >= 3) return ids.join("|");
  }
  const p0 = course?.steps?.[0]?.place;
  const p1 = course?.steps?.[1]?.place;
  const a = placeId(p0);
  const b = placeId(p1);
  if (a == null || b == null) return null;
  return `${String(a)}|${String(b)}`;
}

/** 프로필 간 중복 코스 방지용 키 */
export function courseVenueDedupeKey(place) {
  const k = kakaoVenueId(place);
  if (k) return `kakao:${k}`;
  const id = placeId(place);
  if (id != null) return `id:${String(id)}`;
  const w = resolvePlaceWgs84(place);
  const nm = normalizePlaceName(place);
  if (w && nm) {
    return `geo:${nm}:${w.lat.toFixed(5)}:${w.lng.toFixed(5)}`;
  }
  if (w) return `pt:${w.lat.toFixed(5)}:${w.lng.toFixed(5)}`;
  return null;
}

function venueKeysForCourse(course) {
  const keys = [];
  for (const step of course?.steps || []) {
    const k = courseVenueDedupeKey(step.place);
    if (k) keys.push(k);
  }
  return keys;
}

const DEFAULT_PROFILE = COURSE_PROFILES.normal;

/**
 * @param {object} [parsedQuery]
 * @param {object} [profile]
 */
export function calculateCoursePlaceScore(
  place,
  rule,
  parsedQuery = {},
  profile = DEFAULT_PROFILE
) {
  const w = profile.weights;
  const vibes = normalizeArray(place.vibes);
  const liquorTypes = normalizeArray(place.liquorTypes ?? place.liquor_types);
  const tags = normalizeArray(place.tags);

  let score = 0;
  if (coursePlaceMatchesRuleCategories(place, rule.categories))
    score += 30 * w.category;
  if (includesAny(vibes, rule.vibes)) score += 20 * w.vibe;
  if (includesAny(liquorTypes, rule.liquorTypes)) score += 15 * w.liquor;

  const tagMatchCount = countMatches(tags, rule.tags);
  score += Math.min(tagMatchCount * 5, 20) * w.tag;

  const cur = Number(place.curatorCount ?? place.curator_count);
  if (Number.isFinite(cur)) score += Math.min(cur * 2, 20) * w.curator;

  const ov = Number(place.overlapCuratorCount ?? place.overlap_curator_count);
  if (Number.isFinite(ov)) score += Math.min(ov * 4, 24) * w.overlap;

  const openNow = isPlaceOpenNow(place);
  const minutesUntilClose = getMinutesUntilClose(place);

  if (openNow === true) score += 12 * w.openNow;

  if (parsedQuery.rightNow && openNow === false) {
    score -= 100;
  }

  if (parsedQuery.rightNow && minutesUntilClose != null) {
    if (minutesUntilClose < 40) score -= 60;
    else if (minutesUntilClose < 70) score -= 25;
    else if (minutesUntilClose >= (rule.stayMinutes ?? 60)) score += 8;
  }

  return score;
}

function withResolvedCoords(place) {
  const w = resolvePlaceWgs84(place);
  if (!w) return null;
  return { ...place, lat: w.lat, lng: w.lng };
}

export function filterByArea(places, area) {
  if (!area) return places;
  return places.filter((p) => placeMatchesArea(p, area));
}

/**
 * 주소에 "을지로" 토큰이 없어도 `서울 중구` 등으로만 저장된 장소가 많아 `REGION_KEYWORDS`만 쓰면 0건 →
 * `area`를 버리고 전국(또는 넓은 반경) 풀로 코스를 짜 성동·강남 등이 섞이는 문제를 막음.
 * 짧은 단어만 쓰지 않음(부산 중구 등 오탐 방지).
 */
const COURSE_AREA_FALLBACK_PHRASES = {
  을지로: [
    "서울특별시 중구",
    "서울 중구",
    "서울특별시 종로구",
    "서울 종로구",
    "을지로동",
    "을지로1가",
    "을지로2가",
    "을지로3가",
    "을지로4가",
    "을지로5가",
    "을지로6가",
    "을지로7가",
    "남대문로",
    "세종대로",
    "소공동",
    "회현동",
    "다동",
    "무교동",
    "명동",
    "충무로",
    "필동",
    "장교동",
    "인현동",
    "예장동",
    "주교동",
    "입정동",
    "남창동",
    "봉래동",
  ],
};

function filterPlacesByCourseAreaFallback(places, areaKey) {
  const phrases = COURSE_AREA_FALLBACK_PHRASES[areaKey];
  if (!phrases?.length || !Array.isArray(places)) return [];
  return places.filter((p) => {
    const blob = placeAreaHaystack(p);
    if (areaKey === "을지로") {
      if (
        EULJIRO_EXCLUDED_GU_MARKERS.some((g) =>
          blob.includes(String(g).toLowerCase())
        )
      ) {
        return false;
      }
    }
    return phrases.some((s) => blob.includes(String(s).toLowerCase()));
  });
}

/**
 * 코스 엔진·1·2차 재생성 공통: 지역 키워드 매칭 → 주소구문 완화 → 그래도 없으면 area 해제·전체 풀
 */
export function resolveCourseAreaPool(places, parsedQuery) {
  let areaPlaces = filterByArea(places, parsedQuery.area);
  let effectiveParsed = parsedQuery;
  if (!areaPlaces.length && parsedQuery.area) {
    const relaxed = filterPlacesByCourseAreaFallback(places, parsedQuery.area);
    if (relaxed.length) {
      areaPlaces = relaxed;
    } else {
      areaPlaces = places;
      effectiveParsed = { ...parsedQuery, area: null };
    }
  }
  return { areaPlaces, effectiveParsed };
}

function choosePattern(parsed) {
  if (parsed.includeHalfStep && parsed.steps === 2) {
    const mode = parsed.mode ?? parsed.dateMode;
    if (mode === "date") return COURSE_PATTERNS.date_3step;
    return COURSE_PATTERNS.casual_3step;
  }
  if (parsed.steps !== 2) return null;
  const mode = parsed.mode ?? parsed.dateMode;
  if (mode === "date") return COURSE_PATTERNS.date_2step;
  return COURSE_PATTERNS.casual_2step;
}

function rankByRule(places, rule, parsedQuery, profile) {
  return places
    .map(withResolvedCoords)
    .filter(Boolean)
    .map((place) => ({
      ...place,
      matchScore: calculateCoursePlaceScore(place, rule, parsedQuery, profile),
    }))
    .filter((place) => place.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

function tryBuildCoursesForProfile({
  firstCandidates,
  secondPool,
  rule1,
  rule2,
  distanceLimit,
  parsedQuery,
  profile,
  rng,
}) {
  const results = [];

  for (const first of firstCandidates) {
    const firstClose = getMinutesUntilClose(first);
    if (
      parsedQuery.rightNow &&
      firstClose != null &&
      firstClose < (rule1.stayMinutes ?? 90) * 0.6
    ) {
      continue;
    }

    const secondCandidates = secondPool
      .filter(
        (second) =>
          !isSameVenueForCourseStep(first, second) &&
          haversineMeters(
            Number(first.lat),
            Number(first.lng),
            Number(second.lat),
            Number(second.lng)
          ) >= SECOND_MIN_DISTANCE_METERS
      )
      .map((second) => {
        const distance = haversineMeters(
          Number(first.lat),
          Number(first.lng),
          Number(second.lat),
          Number(second.lng)
        );
        const distanceBonus =
          Math.max(0, 30 - distance / 25) * profile.weights.distance;

        const secondClose = getMinutesUntilClose(second);
        let timingBonus = 0;
        if (parsedQuery.rightNow && secondClose != null) {
          if (secondClose >= (rule2.stayMinutes ?? 60)) timingBonus += 10;
          else if (secondClose < 40) timingBonus -= 50;
        }

        return {
          ...second,
          distanceFromFirst: Math.round(distance),
          pairScore:
            first.matchScore +
            second.matchScore +
            distanceBonus +
            timingBonus,
        };
      })
      .filter((second) =>
        Number.isFinite(distanceLimit) && distanceLimit < 1e8
          ? second.distanceFromFirst <= distanceLimit
          : true
      )
      .sort((a, b) => b.pairScore - a.pairScore);

    if (!secondCandidates.length) continue;

    const pickN = Math.min(5, secondCandidates.length);
    const second = secondCandidates[Math.floor(rng() * pickN)];
    const key = `${profile.key}-${placeId(first)}-${placeId(second)}`;

    results.push({
      key,
      profileKey: profile.key,
      profileTitle: profile.title,
      profileDescription: profile.description,
      totalScore: second.pairScore,
      steps: [
        {
          step: 1,
          label: rule1.label,
          stayMinutes: rule1.stayMinutes,
          place: first,
        },
        {
          step: 2,
          label: rule2.label,
          stayMinutes: rule2.stayMinutes,
          walkDistanceMeters: second.distanceFromFirst,
          place: second,
        },
      ],
    });
  }

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

const BRIDGE_LEG_MIN_M = 45;
const BRIDGE_LEG_MAX_M = 1800;

/** 1차 → 쩜오차 → 2차 (쩜오차는 1차 근처, 2차는 쩜오차 기준 거리) */
function tryBuildCoursesForProfileThree({
  firstCandidates,
  bridgePool,
  secondPool,
  rule1,
  ruleBridge,
  rule2,
  distanceLimitSecond,
  parsedQuery,
  profile,
  rng,
}) {
  const results = [];

  for (const first of firstCandidates) {
    const firstClose = getMinutesUntilClose(first);
    if (
      parsedQuery.rightNow &&
      firstClose != null &&
      firstClose < (rule1.stayMinutes ?? 90) * 0.6
    ) {
      continue;
    }

    const bridgeCandidates = bridgePool
      .filter(
        (b) =>
          !isSameVenueForCourseStep(first, b) &&
          haversineMeters(
            Number(first.lat),
            Number(first.lng),
            Number(b.lat),
            Number(b.lng)
          ) >= BRIDGE_LEG_MIN_M &&
          haversineMeters(
            Number(first.lat),
            Number(first.lng),
            Number(b.lat),
            Number(b.lng)
          ) <= BRIDGE_LEG_MAX_M
      )
      .sort((a, b) => b.matchScore - a.matchScore);

    if (!bridgeCandidates.length) continue;

    const pickBn = Math.min(5, bridgeCandidates.length);
    const bridge = bridgeCandidates[Math.floor(rng() * pickBn)];

    const secondCandidates = secondPool
      .filter(
        (s) =>
          !isSameVenueForCourseStep(first, s) &&
          !isSameVenueForCourseStep(bridge, s) &&
          haversineMeters(
            Number(bridge.lat),
            Number(bridge.lng),
            Number(s.lat),
            Number(s.lng)
          ) >= SECOND_MIN_DISTANCE_METERS
      )
      .map((s) => {
        const distance = haversineMeters(
          Number(bridge.lat),
          Number(bridge.lng),
          Number(s.lat),
          Number(s.lng)
        );
        const distanceBonus =
          Math.max(0, 30 - distance / 25) * profile.weights.distance;

        const secondClose = getMinutesUntilClose(s);
        let timingBonus = 0;
        if (parsedQuery.rightNow && secondClose != null) {
          if (secondClose >= (rule2.stayMinutes ?? 60)) timingBonus += 10;
          else if (secondClose < 40) timingBonus -= 50;
        }

        return {
          ...s,
          distanceFromBridge: Math.round(distance),
          pairScore:
            first.matchScore +
            bridge.matchScore +
            s.matchScore +
            distanceBonus +
            timingBonus,
        };
      })
      .filter((s) =>
        Number.isFinite(distanceLimitSecond) && distanceLimitSecond < 1e8
          ? s.distanceFromBridge <= distanceLimitSecond
          : true
      )
      .sort((a, b) => b.pairScore - a.pairScore);

    if (!secondCandidates.length) continue;

    const pickN = Math.min(5, secondCandidates.length);
    const second = secondCandidates[Math.floor(rng() * pickN)];
    const dFirstBridge = Math.round(
      haversineMeters(
        Number(first.lat),
        Number(first.lng),
        Number(bridge.lat),
        Number(bridge.lng)
      )
    );

    const key = `${profile.key}-${placeId(first)}-${placeId(bridge)}-${placeId(second)}`;

    results.push({
      key,
      profileKey: profile.key,
      profileTitle: profile.title,
      profileDescription: profile.description,
      totalScore: second.pairScore,
      includeHalfStep: true,
      steps: [
        {
          step: 1,
          label: rule1.label,
          stayMinutes: rule1.stayMinutes,
          place: first,
        },
        {
          step: 2,
          label: ruleBridge.label,
          stayMinutes: ruleBridge.stayMinutes,
          walkDistanceMeters: dFirstBridge,
          place: bridge,
        },
        {
          step: 3,
          label: rule2.label,
          stayMinutes: rule2.stayMinutes,
          walkDistanceMeters: second.distanceFromBridge,
          place: second,
        },
      ],
    });
  }

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

function buildCoursesWithProfile({
  parsedQuery,
  places,
  pattern,
  profile,
  rng,
}) {
  if (Array.isArray(pattern) && pattern.length === 3) {
    const [rule1, ruleBridge, rule2] = pattern;
    const rankedFirst = rankByRule(places, rule1, parsedQuery, profile).slice(
      0,
      20
    );
    const firstCandidates = shuffleHeadInCopy(rankedFirst, 12, rng);
    const bridgePool = rankByRule(places, ruleBridge, parsedQuery, profile);
    const secondPool = rankByRule(places, rule2, parsedQuery, profile);

    if (!firstCandidates.length || !bridgePool.length || !secondPool.length) {
      return [];
    }

    const walkable = Boolean(parsedQuery.walkable);
    const distanceTiers = walkable
      ? [500, 900, 1400, 2800, Number.POSITIVE_INFINITY]
      : [2000, 8000, Number.POSITIVE_INFINITY];

    for (const limit of distanceTiers) {
      const batch = tryBuildCoursesForProfileThree({
        firstCandidates,
        bridgePool,
        secondPool,
        rule1,
        ruleBridge,
        rule2,
        distanceLimitSecond: limit,
        parsedQuery,
        profile,
        rng,
      });
      if (batch.length) return batch;
    }
    return [];
  }

  const [rule1, rule2] = pattern;
  const rankedFirst = rankByRule(places, rule1, parsedQuery, profile).slice(0, 20);
  const firstCandidates = shuffleHeadInCopy(rankedFirst, 12, rng);
  const secondPool = rankByRule(places, rule2, parsedQuery, profile);

  if (!firstCandidates.length || !secondPool.length) return [];

  const walkable = Boolean(parsedQuery.walkable);
  const distanceTiers = walkable
    ? [500, 700, 1000, 3000, Number.POSITIVE_INFINITY]
    : [2000, 8000, Number.POSITIVE_INFINITY];

  for (const limit of distanceTiers) {
    const batch = tryBuildCoursesForProfile({
      firstCandidates,
      secondPool,
      rule1,
      rule2,
      distanceLimit: limit,
      parsedQuery,
      profile,
      rng,
    });
    if (batch.length) return batch;
  }

  return [];
}

/**
 * 점수 상위권 안에서 겹치지 않는 코스만 모은 뒤, 그중 무작위 1개
 * (항상 1등만 고르면 같은 식당만 반복되는 문제 완화)
 */
function pickBestDistinctCourse(
  courses,
  usedVenueKeys,
  rng,
  excludeCourseKeys = new Set(),
  excludeVenuePairKeys = new Set()
) {
  const exK =
    excludeCourseKeys instanceof Set
      ? excludeCourseKeys
      : new Set(excludeCourseKeys || []);
  const exP =
    excludeVenuePairKeys instanceof Set
      ? excludeVenuePairKeys
      : new Set(excludeVenuePairKeys || []);
  const used = usedVenueKeys instanceof Set ? usedVenueKeys : new Set();
  const viable = [];
  for (const course of courses) {
    if (course?.key != null && exK.has(course.key)) continue;
    const pair = courseVenuePairKey(course);
    if (pair && exP.has(pair)) continue;
    const keys = venueKeysForCourse(course);
    if (!keys.length || keys.some((k) => used.has(k))) continue;
    viable.push(course);
  }
  if (!viable.length) return null;
  const poolSize = Math.min(10, viable.length);
  const pool = viable.slice(0, poolSize);
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * 프로필별 성격 다른 코스 최대 3개 (정석·분위기·큐레이터 픽).
 * @param {number} [opts.maxOptions] 1이면 정석 프로필만 1개 (하위 호환)
 * @param {Iterable<string>} [opts.excludeCourseKeys] 이미 본 `course.key` 제외
 * @param {Iterable<string>} [opts.excludeVenuePairKeys] 이미 본 1차·2차 id 조합 제외
 */
export function generateCourseOptions({
  parsedQuery,
  places = [],
  maxOptions = 3,
  excludeCourseKeys = [],
  excludeVenuePairKeys = [],
}) {
  const pattern = choosePattern(parsedQuery);
  if (!pattern || !Array.isArray(pattern) || pattern.length < 2) return [];

  const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(
    places,
    parsedQuery
  );

  if (!areaPlaces.length) return [];

  const profiles =
    maxOptions === 1 ? [COURSE_PROFILES.normal] : COURSE_PROFILE_ORDER;

  const invocationSeed =
    (hashString(String(effectiveParsed?.raw || "")) ^ Date.now()) >>> 0;

  const selectedCourses = [];
  const usedVenueKeys = new Set();
  const excludeKeySet =
    excludeCourseKeys instanceof Set
      ? excludeCourseKeys
      : new Set(excludeCourseKeys || []);
  const excludePairSet =
    excludeVenuePairKeys instanceof Set
      ? excludeVenuePairKeys
      : new Set(excludeVenuePairKeys || []);

  for (const profile of profiles) {
    if (selectedCourses.length >= maxOptions) break;

    const rng = mulberry32(
      (invocationSeed + hashString(profile.key || "")) >>> 0
    );

    const candidates = buildCoursesWithProfile({
      parsedQuery: effectiveParsed,
      places: areaPlaces,
      pattern,
      profile,
      rng,
    });

    if (!candidates.length) continue;

    const picked = pickBestDistinctCourse(
      candidates,
      usedVenueKeys,
      rng,
      excludeKeySet,
      excludePairSet
    );
    if (!picked) continue;

    selectedCourses.push(picked);
    for (const k of venueKeysForCourse(picked)) {
      usedVenueKeys.add(k);
    }
  }

  return selectedCourses;
}

/** 코스 결과 전체 → 지도 마커(중복 id 제거). 선택 코스만 쓰려면 인자로 1요소 배열 전달 */
export function courseOptionsToMapPlaces(options = []) {
  const out = [];
  const seen = new Set();
  for (const course of options) {
    for (const step of course?.steps || []) {
      const p = step.place;
      if (!p) continue;
      const w = resolvePlaceWgs84(p);
      if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
      const id = placeId(p);
      const sid = id != null ? String(id) : `course_${out.length}`;
      if (seen.has(sid)) continue;
      seen.add(sid);
      const lat = w.lat;
      const lng = w.lng;
      const stepNum = Number(step.step) || 1;
      const mapCaption =
        typeof step.label === "string" && step.label.trim()
          ? step.label.trim()
          : stepNum === 1
            ? "1차"
            : "2차";
      out.push({
        ...p,
        id: sid,
        name: p.name,
        place_name: p.place_name || p.name,
        lat,
        lng,
        y: String(lat),
        x: String(lng),
        category_name: p.category_name || "",
        address_name: p.address_name || "",
        isCoursePin: true,
        courseMapCaption: mapCaption,
        courseStepIndex: stepNum,
      });
    }
  }
  return out;
}

/**
 * 2차 재추천 결과(코스 배열) → 지도: 1차 고정 + 2차 후보마다 깜빡임(MapView courseMarkerPulse)
 */
export function courseSecondCandidatesToPulseMapPlaces(courses = []) {
  if (!Array.isArray(courses) || courses.length === 0) return [];
  const out = [];
  const firstPlace = courses[0]?.steps?.[0]?.place;
  if (firstPlace) {
    const w = resolvePlaceWgs84(firstPlace);
    if (w && Number.isFinite(w.lat) && Number.isFinite(w.lng)) {
      const id = placeId(firstPlace);
      const sid = id != null ? String(id) : "course_1st";
      out.push({
        ...firstPlace,
        id: sid,
        name: firstPlace.name,
        place_name: firstPlace.place_name || firstPlace.name,
        lat: w.lat,
        lng: w.lng,
        y: String(w.lat),
        x: String(w.lng),
        category_name: firstPlace.category_name || "",
        address_name: firstPlace.address_name || "",
        isCoursePin: true,
        courseMapCaption: "1차",
        courseStepIndex: 1,
        courseMarkerPulse: false,
      });
    }
  }
  const refSteps = courses[0]?.steps || [];
  if (refSteps.length >= 3) {
    const bp = refSteps[1]?.place;
    const wb = resolvePlaceWgs84(bp);
    if (wb && Number.isFinite(wb.lat) && Number.isFinite(wb.lng)) {
      const bid = placeId(bp);
      const bkey = bid != null ? String(bid) : "course_bridge";
      const firstKey = firstPlace ? String(placeId(firstPlace) ?? "course_1st") : "";
      if (!firstKey || bkey !== firstKey) {
        out.push({
          ...bp,
          id: bkey,
          name: bp.name,
          place_name: bp.place_name || bp.name,
          lat: wb.lat,
          lng: wb.lng,
          y: String(wb.lat),
          x: String(wb.lng),
          category_name: bp.category_name || "",
          address_name: bp.address_name || "",
          isCoursePin: true,
          courseMapCaption: "쩜오차",
          courseStepIndex: 2,
          courseMarkerPulse: false,
        });
      }
    }
  }
  const seenSecond = new Set();
  for (let i = 0; i < courses.length; i++) {
    const steps = courses[i]?.steps || [];
    const p = steps.length >= 2 ? steps[steps.length - 1]?.place : null;
    if (!p) continue;
    const w = resolvePlaceWgs84(p);
    if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
    const id = placeId(p);
    const key =
      id != null ? String(id) : `course_2_${i}_${String(p.name || "").slice(0, 24)}`;
    if (seenSecond.has(key)) continue;
    seenSecond.add(key);
    const lastStep = steps[steps.length - 1];
    const cap =
      typeof lastStep?.label === "string" && lastStep.label.trim()
        ? lastStep.label.trim()
        : "2차";
    out.push({
      ...p,
      id: key,
      name: p.name,
      place_name: p.place_name || p.name,
      lat: w.lat,
      lng: w.lng,
      y: String(w.lat),
      x: String(w.lng),
      category_name: p.category_name || "",
      address_name: p.address_name || "",
      isCoursePin: true,
      courseMapCaption: cap,
      courseStepIndex: Number(lastStep?.step) || 2,
      courseMarkerPulse: true,
    });
  }
  return out;
}
