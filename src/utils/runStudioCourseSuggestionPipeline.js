import {
  compactPlacesForCourseDraftAssist,
  indexPlacesByDraftKey,
} from "./compactPlacesForCourseDraftAssist.js";
import {
  diversifyPlacesForCourseDraft,
  diversityHintForVariant,
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

/**
 * @param {object} p
 * @param {string} p.query
 * @param {object} p.parsed
 * @param {object[]} p.places
 * @param {number} [p.variantSeed]
 * @param {(msg: string) => void} [p.onPhase]
 */
export async function runStudioCourseDraftAssistFromPlaces({
  query,
  parsed,
  places,
  variantSeed = 0,
  preferHiddenGems = false,
  preferCuratorPicks = true,
  onPhase,
}) {
  const stopTarget =
    parsed?.stopTarget ?? courseStopTargetForDraft(parsed);
  const minStops = Math.max(2, Number(stopTarget?.min) || 2);

  const intentFiltered = filterPlacesForCourseSuggestionIntent(
    String(query || "").trim(),
    places
  );
  const areaKey = String(parsed?.area || "").trim();
  const areaPool = areaKey
    ? filterPlacesForCourseArea(intentFiltered, areaKey)
    : intentFiltered;
  const candidatePlaces =
    areaKey && areaPool.length >= 2 ? areaPool : intentFiltered;
  const walkPool = filterPlacesForWalkableCourseDraft(candidatePlaces);
  const walkCandidates =
    walkPool.length >= minStops ? walkPool : candidatePlaces;
  const diversified = diversifyPlacesForCourseDraft(walkCandidates, {
    query,
    variantSeed,
    preferHiddenGems,
    preferCuratorPicks,
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

  onPhase?.("코스 초안 작성 중…");

  const assist = await raceCourseDraftAssist({
    query: String(query || "").trim(),
    parsed,
    places: compact,
    variantSeed,
    diversityHint: diversityHintForVariant(variantSeed, {
      preferHiddenGems,
      preferCuratorPicks,
      parsed,
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
    places: diversified,
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
