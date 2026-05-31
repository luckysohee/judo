import { COURSE_PATTERNS } from "./coursePatterns.js";
import { COURSE_PROFILES } from "./courseProfiles.js";
import { haversineMeters, resolvePlaceWgs84 } from "./placeCoords.js";
import { getMinutesUntilClose } from "./timeUtils.js";
import {
  calculateCoursePlaceScore,
  isSameVenueForCourseStep,
  placeId,
  resolveCourseAreaPool,
} from "./generateCourseOptions.js";

const MIN_STEP_SEPARATION_M = 35;

function choosePattern(parsedQuery) {
  if (parsedQuery.includeHalfStep && parsedQuery.steps === 2) {
    const mode = parsedQuery.mode ?? parsedQuery.dateMode;
    if (mode === "date") return COURSE_PATTERNS.date_3step;
    return COURSE_PATTERNS.casual_3step;
  }
  if (parsedQuery.steps !== 2) return null;
  const mode = parsedQuery.mode ?? parsedQuery.dateMode;
  if (mode === "date") return COURSE_PATTERNS.date_2step;
  return COURSE_PATTERNS.casual_2step;
}

function chooseProfile(profileKey) {
  return COURSE_PROFILES[profileKey] || COURSE_PROFILES.normal;
}

function withWgs84(place) {
  const w = resolvePlaceWgs84(place);
  if (!w) return null;
  return { ...place, lat: w.lat, lng: w.lng };
}

/**
 * 2차는 유지하고 1차만 다시 스코어링해 상위 후보 코스를 반환.
 */
export function regenerateFirstStep({
  selectedCourse,
  parsedQuery,
  places = [],
}) {
  if (!selectedCourse?.steps?.length) return [];

  const stepsIn = selectedCourse.steps || [];
  const useBridgeLayout = stepsIn.length >= 3;
  const pattern = useBridgeLayout
    ? (parsedQuery.mode ?? parsedQuery.dateMode) === "date"
      ? COURSE_PATTERNS.date_3step
      : COURSE_PATTERNS.casual_3step
    : choosePattern(parsedQuery);
  if (!pattern) return [];

  const [rule1] = pattern;
  const profile = chooseProfile(selectedCourse.profileKey);

  const secondResolved = withWgs84(selectedCourse.steps[1]?.place);
  const currentFirstResolved = withWgs84(selectedCourse.steps[0]?.place);
  if (!secondResolved || !currentFirstResolved) return [];

  const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(
    places,
    parsedQuery
  );

  const walkable = Boolean(effectiveParsed.walkable);
  const distanceLimits = walkable ? [500, 700, 1000] : [2000];

  const candidates = areaPlaces
    .map(withWgs84)
    .filter(Boolean)
    .filter(
      (place) =>
        !isSameVenueForCourseStep(secondResolved, place) &&
        !isSameVenueForCourseStep(currentFirstResolved, place)
    )
    .map((place) => {
      const distance = haversineMeters(
        Number(place.lat),
        Number(place.lng),
        Number(secondResolved.lat),
        Number(secondResolved.lng)
      );

      if (
        !Number.isFinite(distance) ||
        (distance >= 0 && distance < MIN_STEP_SEPARATION_M)
      ) {
        return null;
      }

      const firstClose = getMinutesUntilClose(place);
      if (
        effectiveParsed.rightNow &&
        firstClose != null &&
        firstClose < (rule1.stayMinutes ?? 90) * 0.6
      ) {
        return null;
      }

      const baseScore = calculateCoursePlaceScore(
        place,
        rule1,
        effectiveParsed,
        profile
      );

      const distanceWeight = profile.weights.distance;
      const distanceBonus = Math.max(0, 30 - distance / 25) * distanceWeight;

      let timingBonus = 0;
      if (effectiveParsed.rightNow && firstClose != null) {
        if (firstClose >= (rule1.stayMinutes ?? 60)) timingBonus += 10;
        else if (firstClose < 40) timingBonus -= 50;
      }

      return {
        ...place,
        distanceToSecond: Math.round(distance),
        candidateScore: baseScore + distanceBonus + timingBonus,
      };
    })
    .filter(Boolean)
    .filter((place) => place.candidateScore > 0);

  let filtered = [];

  for (const limit of distanceLimits) {
    filtered = candidates
      .filter((place) => place.distanceToSecond <= limit)
      .sort((a, b) => b.candidateScore - a.candidateScore);

    if (filtered.length) break;
  }

  const fid = placeId(currentFirstResolved);
  const top = filtered.filter((p) => {
    const pid = placeId(p);
    if (fid != null && pid != null && String(fid) === String(pid)) return false;
    return true;
  });

  const sliceSource = top.length ? top : filtered;

  const secondStepTemplate = selectedCourse.steps[1];
  const thirdStepTemplate = selectedCourse.steps[2];

  return sliceSource.slice(0, 3).map((first) => {
    if (useBridgeLayout && thirdStepTemplate) {
      const bridge = secondResolved;
      const last = withWgs84(thirdStepTemplate.place);
      if (!last) return null;
      const d01 = haversineMeters(
        Number(first.lat),
        Number(first.lng),
        Number(bridge.lat),
        Number(bridge.lng)
      );
      const d12 = haversineMeters(
        Number(bridge.lat),
        Number(bridge.lng),
        Number(last.lat),
        Number(last.lng)
      );
      return {
        key: `${selectedCourse.key}-r1-${placeId(first) ?? first.name}`,
        profileKey: selectedCourse.profileKey,
        profileTitle: selectedCourse.profileTitle,
        profileDescription: selectedCourse.profileDescription,
        regenerated: true,
        regenerateVariant: "first",
        totalScore: first.candidateScore,
        includeHalfStep: true,
        steps: [
          {
            step: 1,
            label: rule1.label,
            stayMinutes: rule1.stayMinutes,
            place: first,
          },
          {
            ...secondStepTemplate,
            step: 2,
            walkDistanceMeters: Math.round(d01),
          },
          {
            ...thirdStepTemplate,
            step: 3,
            walkDistanceMeters: Math.round(d12),
          },
        ],
      };
    }
    const d = haversineMeters(
      Number(first.lat),
      Number(first.lng),
      Number(secondResolved.lat),
      Number(secondResolved.lng)
    );
    return {
      key: `${selectedCourse.key}-r1-${placeId(first) ?? first.name}`,
      profileKey: selectedCourse.profileKey,
      profileTitle: selectedCourse.profileTitle,
      profileDescription: selectedCourse.profileDescription,
      regenerated: true,
      regenerateVariant: "first",
      totalScore: first.candidateScore,
      steps: [
        {
          step: 1,
          label: rule1.label,
          stayMinutes: rule1.stayMinutes,
          place: first,
        },
        {
          ...secondStepTemplate,
          walkDistanceMeters: Math.round(d),
        },
      ],
    };
  }).filter(Boolean);
}
