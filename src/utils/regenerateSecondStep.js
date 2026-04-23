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
import {
  anjuExpandedTokenMatchesHaystack,
  expandAnjuHintTokens,
  expandVibePrefTokens,
} from "./placeTaxonomy.js";

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

function prefStringList(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const out = arr.map((s) => String(s).trim()).filter(Boolean);
  return out.length ? out : null;
}

/**
 * 1차 기준 2차 후보 허용 거리(m) 단계.
 * `maxSecondDistanceM`(지도 2차 찾기 팝업)이 있으면 그 상한까지만 넓혀 가며 후보를 채움.
 */
function resolveSecondStepDistanceLimits(walkable, userSecondPreferences) {
  const raw = userSecondPreferences?.maxSecondDistanceM;
  if (raw != null && Number.isFinite(Number(raw))) {
    const maxM = Math.min(8000, Math.max(500, Number(raw)));
    const tiers = [
      500, 700, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
    ].filter((x) => x <= maxM);
    if (!tiers.length) return [maxM];
    if (tiers[tiers.length - 1] < maxM) return [...tiers, maxM];
    return tiers;
  }
  return walkable ? [500, 700, 1000] : [2000];
}

function placeLiquorTokens(place) {
  const raw = place?.liquorTypes ?? place?.liquor_types;
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (raw == null || raw === "") return [];
  return [String(raw).trim()].filter(Boolean);
}

/** tags·categories·category_name 에서 안주 힌트 매칭용 */
function placeAnjuHaystack(place) {
  const out = [];
  const push = (s) => {
    const t = String(s ?? "").trim().toLowerCase();
    if (t) out.push(t);
  };
  if (Array.isArray(place?.tags)) {
    for (const t of place.tags) push(t);
  }
  if (Array.isArray(place?.categories)) {
    for (const t of place.categories) push(t);
  }
  const cn = place?.category_name;
  if (typeof cn === "string") {
    for (const part of cn.split(/[>,]/g)) push(part);
  }
  return out;
}

/**
 * 1차는 유지하고 2차만 다시 스코어링해 상위 후보 코스를 반환.
 * @param {object} opts
 * @param {object} opts.selectedCourse
 * @param {object} opts.parsedQuery parseCourseQuery 결과
 * @param {object[]} [opts.places] normalizePlaces 결과
 * @param {"same"|"mood"|"closer"|"featured"} [opts.variant]
 * @param {{ vibes?: string[], liquorTypes?: string[], anjuHints?: string[], preferCloser?: boolean, prioritizeCurators?: boolean, maxSecondDistanceM?: number }} [opts.userSecondPreferences] 지도 2차 찾기 등 사용자가 고른 가산점·1차 기준 최대 거리(m)
 */
export function regenerateSecondStep({
  selectedCourse,
  parsedQuery,
  places = [],
  variant = "same",
  userSecondPreferences = null,
}) {
  if (!selectedCourse?.steps?.length) return [];

  const stepsIn = selectedCourse.steps || [];
  const useBridgeAnchor = stepsIn.length >= 3;
  const pattern = useBridgeAnchor
    ? (parsedQuery.mode ?? parsedQuery.dateMode) === "date"
      ? COURSE_PATTERNS.date_3step
      : COURSE_PATTERNS.casual_3step
    : choosePattern(parsedQuery);
  if (!pattern || pattern.length < 2) return [];

  const rule2 = useBridgeAnchor ? pattern[2] : pattern[1];
  const profile = chooseProfile(selectedCourse.profileKey);

  const firstPlace = selectedCourse.steps[0].place;
  const bridgePlace = useBridgeAnchor
    ? selectedCourse.steps[1]?.place
    : null;
  const currentSecond = useBridgeAnchor
    ? selectedCourse.steps[2]?.place
    : selectedCourse.steps[1]?.place;

  const anchorPlace = useBridgeAnchor ? bridgePlace : firstPlace;
  const wAnchor = resolvePlaceWgs84(anchorPlace);
  if (!wAnchor) return [];
  const distanceAnchor = { ...anchorPlace, lat: wAnchor.lat, lng: wAnchor.lng };

  const wFirst = resolvePlaceWgs84(firstPlace);
  if (!wFirst) return [];
  const firstAnchor = { ...firstPlace, lat: wFirst.lat, lng: wFirst.lng };

  const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(
    places,
    parsedQuery
  );

  const walkable = Boolean(effectiveParsed.walkable);
  const distanceLimits = resolveSecondStepDistanceLimits(
    walkable,
    userSecondPreferences
  );

  const candidates = areaPlaces
    .map((place) => {
      const w = resolvePlaceWgs84(place);
      if (!w) return null;
      return { ...place, lat: w.lat, lng: w.lng };
    })
    .filter(Boolean)
    .filter((place) => {
      if (isSameVenueForCourseStep(firstAnchor, place)) return false;
      if (useBridgeAnchor && bridgePlace) {
        if (isSameVenueForCourseStep(distanceAnchor, place)) return false;
      }
      if (!currentSecond) return true;
      const w2 = resolvePlaceWgs84(currentSecond);
      if (w2) {
        return !isSameVenueForCourseStep(
          { ...currentSecond, lat: w2.lat, lng: w2.lng },
          place
        );
      }
      const sid = placeId(currentSecond);
      const pid = placeId(place);
      return sid == null || pid == null || String(sid) !== String(pid);
    })
    .map((place) => {
      const distance = haversineMeters(
        Number(distanceAnchor.lat),
        Number(distanceAnchor.lng),
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

      if (variant === "closer" || userSecondPreferences?.preferCloser) {
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

      const pv = prefStringList(userSecondPreferences?.vibes);
      if (pv?.length) {
        const placeTokens = new Set();
        for (const v of place.vibes || []) {
          const t = String(v).trim().toLowerCase();
          if (t) placeTokens.add(t);
        }
        const at = String(place.atmosphere ?? "").trim().toLowerCase();
        if (at) placeTokens.add(at);
        const hay = [...placeTokens];
        let hits = 0;
        for (const pref of pv) {
          const expanded = expandVibePrefTokens(pref);
          if (
            expanded.some((ex) =>
              hay.some((t) => t.includes(ex) || ex.includes(t) || t === ex)
            )
          ) {
            hits += 1;
          }
        }
        extraBonus += hits * 14;
      }
      const pl = prefStringList(userSecondPreferences?.liquorTypes);
      if (pl?.length) {
        const set = new Set(pl.map((s) => s.toLowerCase()));
        const hits = placeLiquorTokens(place).filter((t) =>
          set.has(String(t).toLowerCase())
        ).length;
        extraBonus += hits * 12;
      }

      const pa = prefStringList(userSecondPreferences?.anjuHints);
      if (pa?.length) {
        const hay = placeAnjuHaystack(place);
        let hits = 0;
        for (const hint of pa) {
          const tokens = expandAnjuHintTokens(hint);
          if (
            tokens.some((tok) =>
              hay.some((t) =>
                anjuExpandedTokenMatchesHaystack(t, tok)
              )
            )
          ) {
            hits += 1;
          }
        }
        extraBonus += hits * 11;
      }

      if (userSecondPreferences?.prioritizeCurators) {
        const overlap = Number(
          place.overlapCuratorCount ?? place.overlap_curator_count
        );
        if (Number.isFinite(overlap) && overlap > 0) {
          extraBonus += Math.min(overlap * 7, 42);
        }
        const curators = Number(place.curatorCount ?? place.curator_count);
        if (Number.isFinite(curators) && curators > 0) {
          extraBonus += Math.min(curators * 3, 24);
        }
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
        distanceFromAnchor: Math.round(distance),
        candidateScore: baseScore + distanceBonus + extraBonus + timingBonus,
      };
    })
    .filter(Boolean)
    .filter((place) => place.candidateScore > 0);

  let filtered = [];

  for (const limit of distanceLimits) {
    filtered = candidates
      .filter((place) => place.distanceFromAnchor <= limit)
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

  return sliceSource.slice(0, 3).map((second) => {
    if (useBridgeAnchor) {
      return {
        key: `${selectedCourse.key}-r2-${variant}-${placeId(second) ?? second.name}`,
        profileKey: selectedCourse.profileKey,
        profileTitle: selectedCourse.profileTitle,
        profileDescription: selectedCourse.profileDescription,
        regenerated: true,
        regenerateVariant: variant,
        totalScore: second.candidateScore,
        includeHalfStep: true,
        steps: [
          { ...selectedCourse.steps[0] },
          { ...selectedCourse.steps[1] },
          {
            step: 3,
            label: rule2.label,
            stayMinutes: rule2.stayMinutes,
            walkDistanceMeters: second.distanceFromAnchor,
            place: second,
          },
        ],
      };
    }
    return {
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
          walkDistanceMeters: second.distanceFromAnchor,
          place: second,
        },
      ],
    };
  });
}

export function getRegenerateSecondLabel(variant) {
  if (variant === "mood") return "분위기 중심";
  if (variant === "closer") return "더 가까운 선택";
  if (variant === "featured") return "큐레이터 픽 강화";
  return "비슷한 결로 재추천";
}
