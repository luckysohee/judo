import {
  compactPlacesForCourseDraftAssist,
  indexPlacesByDraftKey,
  placeKeyForCourseDraftAssist,
} from "./compactPlacesForCourseDraftAssist.js";
import {
  diversifyPlacesForCourseDraft,
  diversityHintForVariant,
  rewriteDraftStepsForDiversity,
} from "./diversifyPlacesForCourseDraft.js";
import { discoverPlacesForCourseSuggestion } from "./discoverPlacesForCourseSuggestion.js";
import {
  courseStopTargetForDraft,
  sanitizeCourseDraftForStopCount,
} from "./parseCourseQuery.js";
import {
  filterPlacesForCourseSuggestionIntent,
  sanitizeCourseDraftForIntent,
  sanitizeCourseDraftForArea,
} from "./filterPlacesForCourseSuggestionIntent.js";
import { filterPlacesForCourseArea } from "./generateCourseOptions.js";
import {
  annotateCompactPlacesWithWalkHints,
  filterPlacesForWalkableCourseDraft,
  sanitizeCourseDraftForWalkability,
} from "./courseDraftWalkability.js";
import { raceCourseDraftAssist } from "./fetchCourseDraftAssist.js";
import { queryWantsNopoFoodFocus } from "./searchParser.js";

/**
 * @param {object} p
 * @param {string} p.query
 * @param {object} p.parsed
 * @param {object[]} p.places — 발견 풀(재생성 시에도 원본 풀 권장)
 * @param {number} [p.variantSeed]
 * @param {string[]} [p.excludePlaceKeys] — 직전 코스 placeKey (다른 조합)
 * @param {(msg: string) => void} [p.onPhase]
 */
export async function runStudioCourseDraftAssistFromPlaces({
  query,
  parsed,
  places,
  variantSeed = 0,
  preferHiddenGems = false,
  preferCuratorPicks = true,
  excludePlaceKeys = [],
  onPhase,
}) {
  const stopTarget =
    parsed?.stopTarget ?? courseStopTargetForDraft(parsed);
  const minStops = Math.max(2, Number(stopTarget?.min) || 2);
  const poolPlaces = Array.isArray(places) ? places.filter(Boolean) : [];
  const excludeKeys = (Array.isArray(excludePlaceKeys) ? excludePlaceKeys : [])
    .map((k) => String(k || "").trim())
    .filter(Boolean);

  const intentFiltered = filterPlacesForCourseSuggestionIntent(
    String(query || "").trim(),
    poolPlaces
  );
  const areaKey = String(parsed?.area || "").trim();
  const areaPool = areaKey
    ? filterPlacesForCourseArea(intentFiltered, areaKey)
    : intentFiltered;
  // 지역 고정이면 권역 밖 풀로 되돌리지 않음 (을지로 재유입 방지)
  let candidatePlaces =
    areaKey && areaPool.length > 0 ? areaPool : intentFiltered;
  if (queryWantsNopoFoodFocus(String(query || "").trim(), null)) {
    candidatePlaces = filterPlacesForCourseSuggestionIntent(
      String(query || "").trim(),
      candidatePlaces,
      { minKeep: 24, minAbsolute: minStops, nopoWidePool: true }
    );
  }
  const walkPool = filterPlacesForWalkableCourseDraft(candidatePlaces);
  const walkCandidates =
    walkPool.length >= minStops ? walkPool : candidatePlaces;
  const diversified = diversifyPlacesForCourseDraft(walkCandidates, {
    query,
    variantSeed,
    preferHiddenGems,
    preferCuratorPicks,
    excludePlaceKeys: excludeKeys,
    placeKeyFn: placeKeyForCourseDraftAssist,
  });
  const compact = annotateCompactPlacesWithWalkHints(
    compactPlacesForCourseDraftAssist(diversified, { limit: 28 }),
    diversified
  );
  if (compact.length < minStops) {
    const roundLabel = stopTarget?.exact && stopTarget?.target
      ? `${stopTarget.target}곳`
      : "2곳";
    throw new Error(
      `AI에 넘길 장소가 ${roundLabel} 코스를 만들기엔 부족해요. 검색어·지역을 바꿔 보세요.`
    );
  }

  const avoidNames = excludeKeys
    .map((k) => {
      const p =
        diversified.find((x) => placeKeyForCourseDraftAssist(x) === k) ||
        poolPlaces.find((x) => placeKeyForCourseDraftAssist(x) === k);
      return String(p?.name || p?.place_name || "").trim();
    })
    .filter(Boolean);

  onPhase?.("코스 초안 작성 중…");

  const assist = await raceCourseDraftAssist({
    query: String(query || "").trim(),
    parsed,
    places: compact,
    variantSeed,
    diversityHint: diversityHintForVariant(variantSeed, {
      preferHiddenGems,
      preferCuratorPicks: preferCuratorPicks && excludeKeys.length === 0,
      parsed,
      avoidPlaceKeys: excludeKeys,
      avoidPlaceNames: avoidNames,
    }),
  });

  if (assist?.quotaExceeded) {
    const err = new Error(
      assist.message ||
        "이번 달 무료 AI 코스 초안 횟수를 모두 사용했어요."
    );
    err.code = "QUOTA_EXCEEDED";
    throw err;
  }

  if (!assist?.draft) {
    const err = new Error(
      assist?.message ||
        "AI 초안을 만들지 못했어요. 잠시 후 다시 시도하거나 검색어를 바꿔 보세요."
    );
    err.code = assist?.reason || "DRAFT_FAILED";
    throw err;
  }

  const placeByKey = indexPlacesByDraftKey(diversified);
  let draft = sanitizeCourseDraftForIntent(
    String(query || "").trim(),
    assist.draft,
    placeByKey
  );
  draft = sanitizeCourseDraftForArea(parsed, draft, placeByKey);
  draft = sanitizeCourseDraftForWalkability(draft, placeByKey);
  draft = sanitizeCourseDraftForStopCount(draft, stopTarget);

  if (excludeKeys.length > 0 && draft?.steps?.length) {
    draft = rewriteDraftStepsForDiversity(draft, excludeKeys, compact, {
      minStops,
      keyFn: (p) => String(p?.placeKey || placeKeyForCourseDraftAssist(p) || "").trim(),
      nameFn: (p) => String(p?.name || p?.place_name || "").trim(),
    });
    // 교체된 placeKey가 diversified에 없으면 풀에서 보강
    for (const step of draft.steps || []) {
      const k = String(step?.placeKey || "").trim();
      if (k && !placeByKey.has(k)) {
        const hit =
          diversified.find((p) => placeKeyForCourseDraftAssist(p) === k) ||
          poolPlaces.find((p) => placeKeyForCourseDraftAssist(p) === k);
        if (hit) placeByKey.set(k, hit);
      }
    }
    draft = sanitizeCourseDraftForArea(parsed, draft, placeByKey);
    draft = sanitizeCourseDraftForWalkability(draft, placeByKey);
    draft = sanitizeCourseDraftForStopCount(draft, stopTarget);
  }

  if (!draft?.steps?.length || draft.steps.length < minStops) {
    const areaLabel = String(parsed?.area || "").trim();
    throw new Error(
      areaLabel
        ? `'${areaLabel}' 일대에서 코스에 넣을 장소가 ${minStops}곳 미만이에요. 검색어를 바꾸거나 해당 지역 장소를 잔 리스트에 올려 보세요.`
        : `AI 초안에 장소가 ${minStops}곳 미만이에요. 검색어를 바꿔 보세요.`
    );
  }

  if (stopTarget?.exact && draft.steps.length !== stopTarget.target) {
    throw new Error(
      `${stopTarget.target}곳 코스인데 ${draft.steps.length}곳만 추천됐어요. 다시 시도하거나 검색어를 바꿔 보세요.`
    );
  }

  return {
    query: String(query || "").trim(),
    parsed,
    /** LLM에 넘긴 섞인 후보 (미리보기용) */
    places: diversified,
    /** 「다른 조합」은 이 풀에서 다시 뽑음 */
    candidatePool: poolPlaces,
    placeByKey,
    draft,
    variantSeed,
    preferHiddenGems,
    preferCuratorPicks,
  };
}

/**
 * query → 장소 수집 → (다양성 섞기) → LLM 초안
 * @param {string} query
 * @param {{
 *   onPhase?: (msg: string) => void,
 *   variantSeed?: number,
 *   curatorUserId?: string,
 *   preferHiddenGems?: boolean,
 *   preferCuratorPicks?: boolean,
 * }} [opts]
 */
export async function runStudioCourseSuggestionPipeline(query, opts = {}) {
  const onPhase = typeof opts.onPhase === "function" ? opts.onPhase : () => {};
  const variantSeed = Number(opts.variantSeed) || 0;
  const preferHiddenGems = opts.preferHiddenGems === true;
  const preferCuratorPicks = opts.preferCuratorPicks !== false;
  const curatorUserId = String(opts.curatorUserId || "").trim();

  const { parsed, places, curatorPickCount = 0 } =
    await discoverPlacesForCourseSuggestion(query, {
      onPhase,
      curatorUserId: preferCuratorPicks && curatorUserId ? curatorUserId : "",
    });

  const draftResult = await runStudioCourseDraftAssistFromPlaces({
    query,
    parsed,
    places,
    variantSeed,
    preferHiddenGems,
    preferCuratorPicks,
    onPhase,
  });

  return { ...draftResult, curatorPickCount };
}
