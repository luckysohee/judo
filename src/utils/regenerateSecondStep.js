import { COURSE_PATTERNS } from "./coursePatterns.js";
import { COURSE_PROFILES } from "./courseProfiles.js";
import {
  haversineMeters,
  resolvePlaceWgs84,
} from "./placeCoords.js";
import { courseWalkCrossesHanRiver } from "./courseRiverCrossing.js";
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
  placeLooksLikeBunsik,
  placeLooksLikeGukmulAnju,
  placeLooksLikeSeafoodAnju,
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
  return walkable ? [500, 700, 1000, 1500] : [800, 1200, 2000, 3000];
}

/**
 * 주종(2차 찾기 체크) → 어울리는 음식·바 카테고리 우선 가산.
 * 고량주→중식, 막걸리·전통주→한식, 위스키→위스키바/바 계열.
 */
const LIQUOR_CATEGORY_STEER = [
  {
    liquors: ["고량주"],
    match: /중식|중국|중화|차이니즈|마라|훠궈|딤섬|짬뽕|탕수육|양꼬치|향(?:신|차이)/,
  },
  {
    liquors: ["막걸리", "전통주"],
    match:
      /한식|한정식|모던\s*한식|전\s*집|부침|빈대떡|파전|전통\s*주점|주막|한상|국밥|보쌈|족발|두부|순대|막걸리|민속주점/,
  },
  {
    liquors: ["위스키"],
    match:
      /위스키|whisky|whiskey|싱글\s*몰트|single\s*malt|스카치|bourbon|버번|위스키바|위스키\s*바/,
  },
];

/** 이름·카테고리에서 주종 추론 (DB liquor_types 비어 있을 때) */
const LIQUOR_INFER_FROM_BLOB = [
  { re: /위스키|whisky|whiskey|싱글\s*몰트|single\s*malt/i, token: "위스키" },
  { re: /하이볼/i, token: "하이볼" },
  { re: /와인|wine/i, token: "와인" },
  { re: /칵테일|cocktail/i, token: "칵테일" },
  { re: /사케|니혼슈|일본술/i, token: "사케" },
  { re: /막걸리/i, token: "막걸리" },
  { re: /전통주|청주|약주/i, token: "전통주" },
  { re: /고량주|바이주/i, token: "고량주" },
  { re: /맥주|beer|호프/i, token: "맥주" },
  { re: /소주/i, token: "소주" },
];

function placeLiquorTokens(place) {
  const raw = place?.liquorTypes ?? place?.liquor_types;
  const fromMeta = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter(Boolean)
    : raw == null || raw === ""
      ? []
      : [String(raw).trim()].filter(Boolean);
  const set = new Set(fromMeta.map((t) => t.toLowerCase()));
  const blob = [
    place?.name,
    place?.place_name,
    place?.category,
    place?.category_name,
    ...(Array.isArray(place?.tags) ? place.tags : []),
    ...(Array.isArray(place?.categories) ? place.categories : []),
  ]
    .map((s) => String(s || ""))
    .join(" ");
  for (const { re, token } of LIQUOR_INFER_FROM_BLOB) {
    if (re.test(blob)) set.add(token.toLowerCase());
  }
  return [...set];
}

/**
 * 점수 상위 풀에서 카테고리·주종 다양성을 살려 최대 `limit`개 고른다.
 * (항상 같은 top-3만 나오면 뻔해지므로)
 */
export function pickDiverseSecondCandidates(ranked, limit = 5) {
  const list = Array.isArray(ranked) ? ranked : [];
  if (list.length <= limit) return list.slice();

  const band = list.slice(0, Math.min(18, list.length));
  const picked = [];
  const usedCats = new Set();
  const usedLiquorSig = new Set();

  const catKey = (p) => {
    const c = String(p?.category || p?.category_name || "")
      .split(/[>,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .pop();
    return String(c || "기타").toLowerCase().slice(0, 24);
  };
  const liquorSig = (p) =>
    placeLiquorTokens(p)
      .slice(0, 3)
      .sort()
      .join("|") || "none";

  // 1패스: 카테고리·주종 시그니처가 겹치지 않게
  for (const p of band) {
    if (picked.length >= limit) break;
    const ck = catKey(p);
    const lk = liquorSig(p);
    if (usedCats.has(ck) && usedLiquorSig.has(lk)) continue;
    picked.push(p);
    usedCats.add(ck);
    usedLiquorSig.add(lk);
  }
  // 2패스: 부족하면 점수순으로 채움
  for (const p of band) {
    if (picked.length >= limit) break;
    if (picked.includes(p)) continue;
    picked.push(p);
  }
  return picked;
}

/** category·category_name·tags·categories 합친 소문자 문자열 */
function placeCategoryHaystack(place) {
  const out = [];
  const push = (s) => {
    const t = String(s ?? "").trim().toLowerCase();
    if (t) out.push(t);
  };
  push(place?.category);
  push(place?.category_name);
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
  return out.join(" ");
}

/** tags·categories·category_name·상호 에서 안주 힌트 매칭용 */
function placeAnjuHaystack(place) {
  const out = [];
  const push = (s) => {
    const t = String(s ?? "").trim().toLowerCase();
    if (t) out.push(t);
  };
  push(place?.name);
  push(place?.place_name);
  push(place?.category);
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

  /** 마지막 스텝 = 실제「2차」(바·술집). 3스텝 패턴에서 `pattern[1]`은 쩜오차라서 여기 쓰면 후보 점수가 전부 0에 가깝게 나감. */
  const rule2 = pattern[pattern.length - 1];
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

  // 지도 「2차 찾기」는 지역 키워드보다 1차 주변 거리 우선 (주소 area 오탐으로 풀이 비는 것 방지)
  const mapSecondFind = Boolean(userSecondPreferences);
  const { areaPlaces, effectiveParsed } = mapSecondFind
    ? {
        areaPlaces: Array.isArray(places) ? places : [],
        effectiveParsed: (() => {
          const { area: _a, ...rest } = parsedQuery || {};
          return rest;
        })(),
      }
    : resolveCourseAreaPool(places, parsedQuery);

  const walkable = Boolean(effectiveParsed.walkable);
  const distanceLimits = resolveSecondStepDistanceLimits(
    walkable,
    userSecondPreferences
  );
  const hasUserMaxDistance =
    userSecondPreferences?.maxSecondDistanceM != null &&
    Number.isFinite(Number(userSecondPreferences.maxSecondDistanceM));
  const prioritizeCurators = Boolean(userSecondPreferences?.prioritizeCurators);

  // 주종→음식 카테고리 우선이 요청됐는지(고량주·막걸리·전통주) — UI 안내 문구용
  const requestedLiquorSet = new Set(
    (prefStringList(userSecondPreferences?.liquorTypes) || []).map((s) =>
      s.toLowerCase()
    )
  );
  const liquorSteerRequested = LIQUOR_CATEGORY_STEER.some((steer) =>
    steer.liquors.some((l) => requestedLiquorSet.has(l.toLowerCase()))
  );

  const candidates = areaPlaces
    .map((place) => {
      const w = resolvePlaceWgs84(place);
      if (!w) return null;
      return { ...place, lat: w.lat, lng: w.lng };
    })
    .filter(Boolean)
    .filter((place) => {
      // 도보 의도일 때만 한강 횡단 제외. 지도 2차 찾기(prefs)만으로 한강 필터를 켜지 않음.
      if (!walkable) return true;
      return !courseWalkCrossesHanRiver(
        Number(distanceAnchor.lat),
        Number(distanceAnchor.lng),
        Number(place.lat),
        Number(place.lng)
      );
    })
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
      let liquorCategoryMatched = false;
      const pl = prefStringList(userSecondPreferences?.liquorTypes);
      if (pl?.length) {
        const set = new Set(pl.map((s) => s.toLowerCase()));
        const placeTokens = placeLiquorTokens(place);
        const hits = placeTokens.filter((t) =>
          set.has(String(t).toLowerCase())
        ).length;
        // 사용자가 고른 주종 매칭을 강하게 (rule2 전주종 +15보다 우선)
        extraBonus += hits * 28;

        // 선택한 주종이 하나도 안 맞으면 감점 — 소주포차가 위스키 선택에 뜨는 것 완화
        if (hits === 0 && placeTokens.length > 0) {
          extraBonus -= 10;
        }

        // 주종 → 음식·바 카테고리 우선
        const catHay = placeCategoryHaystack(place);
        const nameHay = `${String(place?.name || "")} ${String(place?.place_name || "")}`.toLowerCase();
        const steerHay = `${catHay} ${nameHay}`;
        for (const steer of LIQUOR_CATEGORY_STEER) {
          const liquorPicked = steer.liquors.some((l) => set.has(l.toLowerCase()));
          if (liquorPicked && steer.match.test(steerHay)) {
            extraBonus += 26;
            liquorCategoryMatched = true;
          }
        }
      }

      const pa = prefStringList(userSecondPreferences?.anjuHints);
      const wantsSeafoodAnju = Boolean(
        pa?.some((h) => /해산물|해산물\/회|^회$/.test(String(h)))
      );
      const wantsGukmulAnju = Boolean(
        pa?.some((h) => /^국물$|해장|찌개|국밥|전골/.test(String(h)))
      );
      if (
        (wantsSeafoodAnju || wantsGukmulAnju) &&
        placeLooksLikeBunsik(place)
      ) {
        return null;
      }
      let anjuHits = 0;
      let seafoodAnjuMatched = false;
      let gukmulAnjuMatched = false;
      if (pa?.length) {
        const hay = placeAnjuHaystack(place);
        for (const hint of pa) {
          const tokens = expandAnjuHintTokens(hint);
          if (
            tokens.some((tok) =>
              hay.some((t) =>
                anjuExpandedTokenMatchesHaystack(t, tok)
              )
            )
          ) {
            anjuHits += 1;
          }
        }
        extraBonus += anjuHits * 11;
        if (wantsSeafoodAnju && placeLooksLikeSeafoodAnju(place)) {
          seafoodAnjuMatched = true;
          extraBonus += 36;
        } else if (wantsSeafoodAnju && anjuHits === 0) {
          // 해산물 선택인데 회·해물 신호가 없으면 거리만으로 분식·일반집이 위로 오지 않게
          extraBonus -= 40;
        }
        if (wantsGukmulAnju && placeLooksLikeGukmulAnju(place)) {
          gukmulAnjuMatched = true;
          extraBonus += 36;
        } else if (wantsGukmulAnju && anjuHits === 0) {
          extraBonus -= 40;
        }
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

      // 태그·카테고리 없는 카카오/DB 장소도 허용 거리 안이면 후보에 남기기
      const proximityFloor = Math.max(0, Math.round(30 - distance / 100));

      const secondClose = getMinutesUntilClose(place);
      let timingBonus = 0;
      if (effectiveParsed.rightNow && secondClose != null) {
        if (secondClose >= (rule2.stayMinutes ?? 60)) timingBonus += 10;
        else if (secondClose < 40) timingBonus -= 50;
      }

      return {
        ...place,
        distanceFromAnchor: Math.round(distance),
        candidateScore:
          baseScore +
          distanceBonus +
          extraBonus +
          timingBonus +
          proximityFloor,
        liquorCategoryMatched,
        seafoodAnjuMatched,
        gukmulAnjuMatched,
        anjuHits,
      };
    })
    .filter(Boolean)
    .filter((place) => place.candidateScore > 0);

  const anjuPrefList = prefStringList(userSecondPreferences?.anjuHints);
  const wantsSeafoodAnjuPool = Boolean(
    anjuPrefList?.some((h) => /해산물|해산물\/회|^회$/.test(String(h)))
  );
  const wantsGukmulAnjuPool = Boolean(
    anjuPrefList?.some((h) => /^국물$|해장|찌개|국밥|전골/.test(String(h)))
  );
  // 해산물·국물: 신호 있는 후보가 있으면 그쪽으로만 좁힘
  let scoredPool = candidates;
  if (wantsSeafoodAnjuPool) {
    const seafoodOnly = candidates.filter(
      (p) => p.seafoodAnjuMatched || (p.anjuHits ?? 0) > 0
    );
    if (seafoodOnly.length) scoredPool = seafoodOnly;
  } else if (wantsGukmulAnjuPool) {
    const gukmulOnly = candidates.filter(
      (p) => p.gukmulAnjuMatched || (p.anjuHits ?? 0) > 0
    );
    if (gukmulOnly.length) scoredPool = gukmulOnly;
  }

  let filtered = [];
  if (hasUserMaxDistance) {
    // 사용자가 최대 거리를 명시하면 그 상한까지 전체 후보를 본다(근거리 tier 조기종료 금지).
    const userLimit = Math.max(...distanceLimits);
    filtered = scoredPool
      .filter((place) => place.distanceFromAnchor <= userLimit)
      .sort((a, b) => {
        if (prioritizeCurators) {
          const aCur = Number(a.overlapCuratorCount ?? a.overlap_curator_count ?? 0);
          const bCur = Number(b.overlapCuratorCount ?? b.overlap_curator_count ?? 0);
          if (bCur !== aCur) return bCur - aCur;
          const aCnt = Number(a.curatorCount ?? a.curator_count ?? 0);
          const bCnt = Number(b.curatorCount ?? b.curator_count ?? 0);
          if (bCnt !== aCnt) return bCnt - aCnt;
        }
        return b.candidateScore - a.candidateScore;
      });
  } else {
    for (const limit of distanceLimits) {
      filtered = scoredPool
        .filter((place) => place.distanceFromAnchor <= limit)
        .sort((a, b) => {
          if (prioritizeCurators) {
            const aCur = Number(a.overlapCuratorCount ?? a.overlap_curator_count ?? 0);
            const bCur = Number(b.overlapCuratorCount ?? b.overlap_curator_count ?? 0);
            if (bCur !== aCur) return bCur - aCur;
            const aCnt = Number(a.curatorCount ?? a.curator_count ?? 0);
            const bCnt = Number(b.curatorCount ?? b.curator_count ?? 0);
            if (bCnt !== aCnt) return bCnt - aCnt;
          }
          return b.candidateScore - a.candidateScore;
        });

      if (filtered.length) break;
    }
  }

  const sid = placeId(currentSecond);
  const top = filtered.filter((p) => {
    const pid = placeId(p);
    if (sid != null && pid != null && String(sid) === String(pid)) return false;
    return true;
  });

  const sliceSource = top.length ? top : filtered;
  let diverse = pickDiverseSecondCandidates(sliceSource, 5);

  // 지도 2차: 점수·거리 단계로도 비면 1차 주변 가까운 순으로 강제 후보
  if (!diverse.length && mapSecondFind) {
    const maxM = hasUserMaxDistance
      ? Math.max(...distanceLimits)
      : Math.max(...distanceLimits, 3000);
    const anjuPrefs = prefStringList(userSecondPreferences?.anjuHints);
    const wantsSeafoodAnju = Boolean(
      anjuPrefs?.some((h) => /해산물|해산물\/회|^회$/.test(String(h)))
    );
    const wantsGukmulAnju = Boolean(
      anjuPrefs?.some((h) => /^국물$|해장|찌개|국밥|전골/.test(String(h)))
    );
    const nearby = areaPlaces
      .map((place) => {
        const w = resolvePlaceWgs84(place);
        if (!w) return null;
        const withCoords = { ...place, lat: w.lat, lng: w.lng };
        if (isSameVenueForCourseStep(firstAnchor, withCoords)) return null;
        if (
          (wantsSeafoodAnju || wantsGukmulAnju) &&
          placeLooksLikeBunsik(withCoords)
        ) {
          return null;
        }
        const distance = haversineMeters(
          Number(distanceAnchor.lat),
          Number(distanceAnchor.lng),
          w.lat,
          w.lng
        );
        if (!Number.isFinite(distance) || distance < 35 || distance > maxM) {
          return null;
        }
        const seafoodHit =
          wantsSeafoodAnju && placeLooksLikeSeafoodAnju(withCoords);
        const gukmulHit =
          wantsGukmulAnju && placeLooksLikeGukmulAnju(withCoords);
        // 해산물·국물 선택 시 근처 폴백도 신호 있는 곳만
        if (wantsSeafoodAnju && !seafoodHit) return null;
        if (wantsGukmulAnju && !gukmulHit) return null;
        let score = Math.max(1, Math.round(40 - distance / 80));
        if (seafoodHit || gukmulHit) score += 20;
        return {
          ...withCoords,
          distanceFromAnchor: Math.round(distance),
          candidateScore: score,
          liquorCategoryMatched: false,
          seafoodAnjuMatched: seafoodHit,
          gukmulAnjuMatched: gukmulHit,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.candidateScore - a.candidateScore || a.distanceFromAnchor - b.distanceFromAnchor);
    diverse = pickDiverseSecondCandidates(nearby, 5);
  }

  return diverse.map((second) => {
    if (useBridgeAnchor) {
      return {
        key: `${selectedCourse.key}-r2-${variant}-${placeId(second) ?? second.name}`,
        profileKey: selectedCourse.profileKey,
        profileTitle: selectedCourse.profileTitle,
        profileDescription: selectedCourse.profileDescription,
        regenerated: true,
        regenerateVariant: variant,
        totalScore: second.candidateScore,
        liquorSteerRequested,
        liquorCategoryMatched: Boolean(second.liquorCategoryMatched),
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
      liquorSteerRequested,
      liquorCategoryMatched: Boolean(second.liquorCategoryMatched),
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
