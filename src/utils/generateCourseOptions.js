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

function placeMatchesArea(place, areaKey) {
  if (!areaKey) return true;
  const blob = placeAreaHaystack(place);
  const synonyms = REGION_KEYWORDS[areaKey];
  if (synonyms?.length) {
    return synonyms.some((s) => blob.includes(String(s).toLowerCase()));
  }
  return blob.includes(String(areaKey).toLowerCase());
}

function includesAny(source, target) {
  if (!source.length || !target.length) return false;
  const set = new Set(source.map((x) => String(x).toLowerCase()));
  return target.some((t) => set.has(String(t).toLowerCase()));
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

/** 1차·2차 장소 id 조합 (프로필 무관 — 이미 본 조합 제외용) */
export function courseVenuePairKey(course) {
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
  const categories = placeCategories(place);
  const vibes = normalizeArray(place.vibes);
  const liquorTypes = normalizeArray(place.liquorTypes ?? place.liquor_types);
  const tags = normalizeArray(place.tags);

  let score = 0;
  if (includesAny(categories, rule.categories)) score += 30 * w.category;
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

function choosePattern(parsed) {
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

function buildCoursesWithProfile({
  parsedQuery,
  places,
  rule1,
  rule2,
  profile,
  rng,
}) {
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
  if (!pattern) return [];

  const [rule1, rule2] = pattern;

  let areaPlaces = filterByArea(places, parsedQuery.area);
  let effectiveParsed = parsedQuery;

  if (!areaPlaces.length && parsedQuery.area) {
    areaPlaces = places;
    effectiveParsed = { ...parsedQuery, area: null };
  }

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
      rule1,
      rule2,
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
      const id = placeId(p);
      const sid = id != null ? String(id) : `course_${out.length}`;
      if (seen.has(sid)) continue;
      seen.add(sid);
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const stepNum = Number(step.step) || 1;
      const mapCaption = stepNum === 1 ? "1차" : "2차";
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
