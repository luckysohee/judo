import { COURSE_PATTERNS } from "./coursePatterns.js";
import { COURSE_PROFILES } from "./courseProfiles.js";
import { haversineMeters } from "./placeCoords.js";
import { getMinutesUntilClose } from "./timeUtils.js";
import {
  calculateCoursePlaceScore,
  filterByArea,
  isSameVenueForCourseStep,
  placeId,
} from "./generateCourseOptions.js";

function choosePattern(parsedQuery) {
  if (parsedQuery.steps !== 2) return null;
  const mode = parsedQuery.mode ?? parsedQuery.dateMode;
  if (mode === "date") return COURSE_PATTERNS.date_2step;
  return COURSE_PATTERNS.casual_2step;
}

function chooseProfile(profileKey) {
  return COURSE_PROFILES[profileKey] || COURSE_PROFILES.normal;
}

/**
 * 1차는 유지하고 2차만 다시 스코어링해 상위 후보 코스를 반환.
 * @param {object} opts
 * @param {object} opts.selectedCourse
 * @param {object} opts.parsedQuery parseCourseQuery 결과
 * @param {object[]} [opts.places] normalizePlaces 결과
 * @param {"same"|"mood"|"closer"|"featured"} [opts.variant]
 */
export function regenerateSecondStep({
  selectedCourse,
  parsedQuery,
  places = [],
  variant = "same",
}) {
  if (!selectedCourse?.steps?.length) return [];

  const pattern = choosePattern(parsedQuery);
  if (!pattern) return [];

  const [, rule2] = pattern;
  const profile = chooseProfile(selectedCourse.profileKey);

  const firstPlace = selectedCourse.steps[0].place;
  const currentSecond = selectedCourse.steps[1]?.place;

  let areaPlaces = filterByArea(places, parsedQuery.area);
  let effectiveParsed = parsedQuery;
  if (!areaPlaces.length && parsedQuery.area) {
    areaPlaces = places;
    effectiveParsed = { ...parsedQuery, area: null };
  }

  const walkable = Boolean(effectiveParsed.walkable);
  const distanceLimits = walkable ? [500, 700, 1000] : [2000];

  const candidates = areaPlaces
    .filter(
      (place) =>
        !isSameVenueForCourseStep(firstPlace, place) &&
        (!currentSecond || !isSameVenueForCourseStep(currentSecond, place))
    )
    .map((place) => {
      const distance = haversineMeters(
        Number(firstPlace.lat),
        Number(firstPlace.lng),
        Number(place.lat),
        Number(place.lng)
      );

      const minBetween = 35;
      if (!Number.isFinite(distance) || (distance >= 0 && distance < minBetween)) {
        return null;
      }

      const baseScore = calculateCoursePlaceScore(
        place,
        rule2,
        effectiveParsed,
        profile
      );

      let distanceWeight = profile.weights.distance;
      let extraBonus = 0;

      if (variant === "closer") {
        distanceWeight *= 1.8;
      }

      if (variant === "mood") {
        const moodSet = new Set(
          ["분위기좋은", "조용한", "편안한"].map((s) => s.toLowerCase())
        );
        const moodMatches = (place.vibes || []).filter((v) =>
          moodSet.has(String(v).toLowerCase())
        ).length;
        extraBonus += moodMatches * 8;
      }

      if (variant === "featured") {
        extraBonus += Math.min((place.overlapCuratorCount || 0) * 6, 30);
      }

      const distanceBonus = Math.max(0, 30 - distance / 25) * distanceWeight;

      const secondClose = getMinutesUntilClose(place);
      let timingBonus = 0;
      if (effectiveParsed.rightNow && secondClose != null) {
        if (secondClose >= (rule2.stayMinutes ?? 60)) timingBonus += 10;
        else if (secondClose < 40) timingBonus -= 50;
      }

      return {
        ...place,
        distanceFromFirst: Math.round(distance),
        candidateScore: baseScore + distanceBonus + extraBonus + timingBonus,
      };
    })
    .filter(Boolean)
    .filter((place) => place.candidateScore > 0);

  let filtered = [];

  for (const limit of distanceLimits) {
    filtered = candidates
      .filter((place) => place.distanceFromFirst <= limit)
      .sort((a, b) => b.candidateScore - a.candidateScore);

    if (filtered.length) break;
  }

  const sid = placeId(currentSecond);
  const top = filtered.filter((p) => {
    const pid = placeId(p);
    if (sid != null && pid != null && String(sid) === String(pid)) return false;
    return true;
  });

  const sliceSource = top.length ? top : filtered;

  return sliceSource.slice(0, 3).map((second) => ({
    key: `${selectedCourse.key}-r2-${variant}-${placeId(second) ?? second.name}`,
    profileKey: selectedCourse.profileKey,
    profileTitle: selectedCourse.profileTitle,
    profileDescription: selectedCourse.profileDescription,
    regenerated: true,
    regenerateVariant: variant,
    totalScore: second.candidateScore,
    steps: [
      { ...selectedCourse.steps[0] },
      {
        step: 2,
        label: rule2.label,
        stayMinutes: rule2.stayMinutes,
        walkDistanceMeters: second.distanceFromFirst,
        place: second,
      },
    ],
  }));
}

export function getRegenerateSecondLabel(variant) {
  if (variant === "mood") return "분위기 중심";
  if (variant === "closer") return "더 가까운 선택";
  if (variant === "featured") return "큐레이터 픽 강화";
  return "비슷한 결로 재추천";
}
