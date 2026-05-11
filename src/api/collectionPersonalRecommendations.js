import { supabase } from "./client";
import {
  dedupeAndNormalizeCollectionTags,
  normalizeCollectionTag,
} from "../utils/collectionTags";

/**
 * "당신 취향의 코스" — 로그인 유저의 저장 행동 기반 lightweight 추천.
 *
 * 검색·지도·`useCourseSearch` 와 무관하게 단독으로 동작하는 휴리스틱이다.
 * (운영 데이터가 적어도 자연스럽게 0건/소수건이 떨어지도록 모든 보조 fetch 는
 * best-effort 로 실패해도 빈 결과로 fallback 한다.)
 *
 * 절차:
 *  1. 내가 최근 저장한 공개 컬렉션들에서 다음 통계 추출.
 *      각 시그널은 누적 카운트(`totalCount`) 와 최근 N일 카운트(`recentCount`) 를
 *      함께 보관하고, 매칭 가중치는 `0.6·recent + 0.4·cumulative` 로 합산한다
 *      (최근 저장 시그널 60% / 누적 저장 시그널 40%).
 *      - tag 빈도(`collections.tags`)
 *      - step_label 빈도(`collection_places.step_label`)
 *      - 저장한 컬렉션의 place_id 모음(겹침 시그널, recent/all 두 집합)
 *  2. 후보 풀 = `tags && topTags`  ∪  `step_label.in(topSteps)`  ∪
 *               `place_id.in(myPlaceIds)` 로 모은 공개 컬렉션
 *      (자기 컬렉션·이미 저장한 컬렉션 제외).
 *  3. 각 후보의 (tags, step_labels, place_ids) 를 fetch 해 점수 계산
 *      score = 3·tagFreqMatch + 2·stepFreqMatch + 1·placeOverlap
 *      여기서 모든 매치는 위의 가중치 합으로 누적된다.
 *  4. 가장 큰 기여 요인으로 한 줄 reason 문구 생성.
 *      - tag dom    : `"${tag} 코스를 좋아하네요"`
 *      - step dom   : `"${step} 흐름을 자주 저장했어요"`
 *      - place dom  : `"이미 저장한 장소가 ${n}곳 들어있어요"`
 *  5. 별도로 "요즘 ${tag} 코스를 자주 저장하고 있어요" 같은
 *      contextual copy 용 trending 시그널을 도출(최근 N일 기준).
 *
 * 저장이 없으면 **좋아요한 컬렉션** 시그널을 동일 파이프라인으로 사용하고,
 * 그것도 없으면 `profiles.preference_tags`(온보딩) 로 태그 후보만 매칭한다.
 *
 * 필요 SELECT 권한:
 *  - `collections` (visibility='public' 자동 필터, 본인 행은 user_id 매칭)
 *  - `collection_places` (FK SELECT 허용)
 *  - `collection_saves` / `collection_likes` (RLS 가 본인 행만 노출)
 *  - `profiles.preference_tags` (본인 행)
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RECENT_SAVES_POOL = 30;
const TOP_TAG_PICK = 6;
const TOP_STEP_PICK = 5;
const PLACE_FETCH_CAP = 80;
const TAG_CANDIDATE_LIMIT = 160;
const STEP_CANDIDATE_LIMIT = 160;
const PLACE_CANDIDATE_LIMIT = 200;
const HARD_CANDIDATE_CAP = 240;
const STEP_LABEL_VISIBLE = 3;

const W_TAG = 3;
const W_STEP = 2;
const W_PLACE = 1;

/**
 * 최근/누적 저장 시그널 가중치.
 * 한 시그널의 weighted = `RECENT_WEIGHT * recentCount + CUM_WEIGHT * totalCount`.
 * 최근 저장(=cutoff 이후)은 `total` 에도 포함되므로 사실상 1.0(누적) + 0.6(부스트) 의
 * "추가 가중" 이 부여된다 — "최근 저장 시그널 60%" 휴리스틱.
 */
const RECENT_DAYS = 7;
const RECENT_WEIGHT = 0.6;
const CUM_WEIGHT = 0.4;

/** trending hint 노출 최소 임계 — 단발성 저장 noise 방지. */
const TRENDING_MIN_RECENT = 2;

function safeNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normStepLabel(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

function isFeaturedActiveRow(row) {
  if (!row || row.is_featured !== true) return false;
  const until = row.featured_until;
  if (until == null) return true;
  const t = new Date(until).getTime();
  if (!Number.isFinite(t)) return true;
  return t > Date.now();
}

/**
 * @typedef {{
 *   id: string,
 *   title: string | null,
 *   cover_image_url: string | null,
 *   vibe_caption: string | null,
 *   step_labels: string[],
 *   tags: string[],
 *   place_count: number,
 *   like_count: number,
 *   save_count: number,
 *   score: number,
 *   reason: string,
 *   reason_kind: 'tag' | 'step' | 'place' | 'mix',
 *   matched_tag: string | null,
 *   matched_step_label: string | null,
 *   matched_place_count: number,
 *   is_featured_active: boolean,
 * }} PersonalCollectionRecommendation
 */

/**
 * @typedef {{
 *   kind: 'tag' | 'step',
 *   label: string,
 *   recent_count: number,
 *   total_count: number,
 *   recent_share: number,
 * }} PersonalRecommendationTrendingHint
 */

/**
 * @typedef {{
 *   items: PersonalCollectionRecommendation[],
 *   trending: PersonalRecommendationTrendingHint | null,
 *   recent_signal_save_count: number,
 *   signal_source: 'saves' | 'likes' | 'preference' | null,
 * }} PersonalRecommendationResult
 */

/**
 * @param {'save'|'like'|'preference'} mode
 * @returns {{ reasonKind: string, reasonText: string }}
 */
function composePersonalReason(
  mode,
  bestTagMatch,
  bestStepMatch,
  placeOverlapDistinct,
  tagContrib,
  stepContrib,
  placeContrib,
) {
  let reasonKind = "mix";
  let reasonText = "취향과 비슷한 흐름이에요";
  const preferTag =
    tagContrib >= stepContrib &&
    tagContrib >= placeContrib &&
    Boolean(bestTagMatch);
  const preferStep =
    stepContrib >= tagContrib &&
    stepContrib >= placeContrib &&
    Boolean(bestStepMatch);

  if (preferTag && bestTagMatch) {
    reasonKind = "tag";
    if (mode === "preference") {
      reasonText = `${bestTagMatch} 취향 태그와 가까워요`;
    } else if (mode === "like") {
      reasonText = `${bestTagMatch} 코스를 마음에 들어 하네요`;
    } else {
      reasonText = `${bestTagMatch} 코스를 좋아하네요`;
    }
  } else if (preferStep && bestStepMatch) {
    reasonKind = "step";
    if (mode === "preference") {
      reasonText = `${bestStepMatch} 흐름이 취향 태그와 잘 맞아요`;
    } else if (mode === "like") {
      reasonText = `${bestStepMatch} 흐름을 좋아요한 편이에요`;
    } else {
      reasonText = `${bestStepMatch} 흐름을 자주 저장했어요`;
    }
  } else if (placeOverlapDistinct > 0) {
    reasonKind = "place";
    const savedWord =
      mode === "like" ? "좋아요한" : mode === "preference" ? "담은" : "저장한";
    reasonText =
      placeOverlapDistinct === 1
        ? `이미 ${savedWord} 장소가 들어있어요`
        : `이미 ${savedWord} 장소 ${placeOverlapDistinct}곳이 들어있어요`;
  } else if (bestTagMatch) {
    reasonKind = "tag";
    reasonText =
      mode === "preference"
        ? `${bestTagMatch} 취향 태그와 가까워요`
        : mode === "like"
          ? `${bestTagMatch} 코스를 마음에 들어 하네요`
          : `${bestTagMatch} 코스를 좋아하네요`;
  } else if (bestStepMatch) {
    reasonKind = "step";
    reasonText =
      mode === "preference"
        ? `${bestStepMatch} 흐름이 취향 태그와 잘 맞아요`
        : mode === "like"
          ? `${bestStepMatch} 흐름을 좋아요한 편이에요`
          : `${bestStepMatch} 흐름을 자주 저장했어요`;
  }
  return { reasonKind, reasonText };
}

/**
 * 주파수 맵이 준비된 뒤 후보 수집·랭킹까지 공통 처리.
 *
 * @param {{
 *   lim: number,
 *   tagFreq: Map<string, { raw: string, recentCount: number, totalCount: number, weighted: number }>,
 *   stepFreq: Map<string, { raw: string, recentCount: number, totalCount: number, weighted: number }>,
 *   myPlaceIds: Set<string>,
 *   myRecentPlaceIds: Set<string>,
 *   excludeIds: Set<string>,
 *   trending: PersonalRecommendationTrendingHint | null,
 *   recent_signal_save_count: number,
 *   signal_source: 'saves' | 'likes' | 'preference' | null,
 *   reasonMode: 'save'|'like'|'preference',
 * }} p
 * @returns {Promise<PersonalRecommendationResult>}
 */
async function finalizePersonalRecommendationsFromFreqMaps(p) {
  const {
    lim,
    tagFreq,
    stepFreq,
    myPlaceIds,
    myRecentPlaceIds,
    excludeIds,
    trending,
    recent_signal_save_count,
    signal_source,
    reasonMode,
  } = p;

  const emptyOut = {
    items: [],
    trending,
    recent_signal_save_count,
    signal_source,
  };

  const topTags = [...tagFreq.values()]
    .filter((t) => t.weighted > 0)
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, TOP_TAG_PICK);
  const topSteps = [...stepFreq.values()]
    .filter((s) => s.weighted > 0)
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, TOP_STEP_PICK);

  if (topTags.length === 0 && topSteps.length === 0 && myPlaceIds.size === 0) {
    return emptyOut;
  }

  const candidateIdSet = new Set();
  if (topTags.length > 0) {
    try {
      const tagValues = topTags.map((t) => t.raw);
      const { data, error } = await supabase
        .from("collections")
        .select("id")
        .eq("visibility", "public")
        .overlaps("tags", tagValues)
        .limit(TAG_CANDIDATE_LIMIT);
      if (error) throw error;
      for (const row of Array.isArray(data) ? data : []) {
        const id = String(row?.id ?? "").trim();
        if (id && !excludeIds.has(id)) candidateIdSet.add(id);
        if (candidateIdSet.size >= HARD_CANDIDATE_CAP) break;
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "finalizePersonalRecommendations candidates(tags):",
          e?.message || e,
        );
      }
    }
  }

  if (topSteps.length > 0 && candidateIdSet.size < HARD_CANDIDATE_CAP) {
    try {
      const stepValues = topSteps.map((s) => s.raw);
      const { data, error } = await supabase
        .from("collection_places")
        .select("collection_id")
        .in("step_label", stepValues)
        .limit(STEP_CANDIDATE_LIMIT * 4);
      if (error) throw error;
      let added = 0;
      for (const row of Array.isArray(data) ? data : []) {
        const id = String(row?.collection_id ?? "").trim();
        if (!id || excludeIds.has(id) || candidateIdSet.has(id)) continue;
        candidateIdSet.add(id);
        added += 1;
        if (added >= STEP_CANDIDATE_LIMIT) break;
        if (candidateIdSet.size >= HARD_CANDIDATE_CAP) break;
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "finalizePersonalRecommendations candidates(step):",
          e?.message || e,
        );
      }
    }
  }

  if (myPlaceIds.size > 0 && candidateIdSet.size < HARD_CANDIDATE_CAP) {
    try {
      const placeValues = [...myPlaceIds].slice(0, PLACE_FETCH_CAP);
      const { data, error } = await supabase
        .from("collection_places")
        .select("collection_id")
        .in("place_id", placeValues)
        .limit(PLACE_CANDIDATE_LIMIT * 4);
      if (error) throw error;
      let added = 0;
      for (const row of Array.isArray(data) ? data : []) {
        const id = String(row?.collection_id ?? "").trim();
        if (!id || excludeIds.has(id) || candidateIdSet.has(id)) continue;
        candidateIdSet.add(id);
        added += 1;
        if (added >= PLACE_CANDIDATE_LIMIT) break;
        if (candidateIdSet.size >= HARD_CANDIDATE_CAP) break;
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "finalizePersonalRecommendations candidates(place):",
          e?.message || e,
        );
      }
    }
  }

  const baseEmpty = { ...emptyOut };
  if (candidateIdSet.size === 0) return baseEmpty;

  const candidateIds = [...candidateIdSet];

  let publicRows = [];
  try {
    const { data, error } = await supabase
      .from("collections")
      .select(
        `
        id, title, cover_image_url, vibe_caption, visibility, tags, created_at,
        is_featured, featured_rank, featured_until,
        collection_places(count),
        collection_likes(count),
        collection_saves(count)
      `,
      )
      .in("id", candidateIds)
      .eq("visibility", "public");
    if (error) throw error;
    publicRows = Array.isArray(data) ? data : [];
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "finalizePersonalRecommendations candidate meta:",
        e?.message || e,
      );
    }
    return baseEmpty;
  }

  if (publicRows.length === 0) return baseEmpty;

  const publicIds = publicRows.map((r) => r.id);

  const placesByCollection = new Map();
  try {
    const { data, error } = await supabase
      .from("collection_places")
      .select("collection_id, place_id, step_label, order_index")
      .in("collection_id", publicIds);
    if (error) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.collection_id ?? "").trim();
      if (!id) continue;
      let bag = placesByCollection.get(id);
      if (!bag) {
        bag = { steps: [], placeIds: new Set() };
        placesByCollection.set(id, bag);
      }
      const pid = String(row?.place_id ?? "").trim();
      if (pid) bag.placeIds.add(pid);
      const lblRaw =
        typeof row?.step_label === "string" ? row.step_label.trim() : "";
      if (lblRaw) {
        bag.steps.push({
          raw: lblRaw,
          norm: lblRaw.toLowerCase(),
          order: safeNumber(row?.order_index, 0),
        });
      }
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "finalizePersonalRecommendations candidate places:",
        e?.message || e,
      );
    }
  }

  const ranked = publicRows
    .map((c) => {
      const bag =
        placesByCollection.get(c.id) || { steps: [], placeIds: new Set() };

      const candidateTags = dedupeAndNormalizeCollectionTags(c?.tags);
      let tagScore = 0;
      let bestTagMatch = null;
      let bestTagFreq = 0;
      for (const t of candidateTags) {
        const norm = normalizeCollectionTag(t);
        if (!norm) continue;
        const entry = tagFreq.get(norm.toLowerCase());
        if (!entry) continue;
        tagScore += entry.weighted;
        if (entry.weighted > bestTagFreq) {
          bestTagFreq = entry.weighted;
          bestTagMatch = entry.raw;
        }
      }

      const seenStep = new Set();
      let stepScore = 0;
      let bestStepMatch = null;
      let bestStepFreq = 0;
      for (const s of bag.steps) {
        if (seenStep.has(s.norm)) continue;
        seenStep.add(s.norm);
        const entry = stepFreq.get(s.norm);
        if (!entry) continue;
        stepScore += entry.weighted;
        if (entry.weighted > bestStepFreq) {
          bestStepFreq = entry.weighted;
          bestStepMatch = entry.raw;
        }
      }

      let placeOverlapTotal = 0;
      let placeOverlapRecent = 0;
      let placeOverlapDistinct = 0;
      for (const pid of bag.placeIds) {
        if (myPlaceIds.has(pid)) {
          placeOverlapTotal += 1;
          placeOverlapDistinct += 1;
          if (myRecentPlaceIds.has(pid)) placeOverlapRecent += 1;
        }
      }
      const placeOverlapWeighted =
        RECENT_WEIGHT * placeOverlapRecent + CUM_WEIGHT * placeOverlapTotal;

      const score =
        W_TAG * tagScore + W_STEP * stepScore + W_PLACE * placeOverlapWeighted;

      const tagContrib = W_TAG * tagScore;
      const stepContrib = W_STEP * stepScore;
      const placeContrib = W_PLACE * placeOverlapWeighted;
      const { reasonKind, reasonText } = composePersonalReason(
        reasonMode,
        bestTagMatch,
        bestStepMatch,
        placeOverlapDistinct,
        tagContrib,
        stepContrib,
        placeContrib,
      );

      const stepsSorted = [...bag.steps].sort((a, b) => a.order - b.order);
      const dedupedStepLabels = [];
      const seenLbl = new Set();
      for (const s of stepsSorted) {
        if (seenLbl.has(s.norm)) continue;
        seenLbl.add(s.norm);
        dedupedStepLabels.push(s.raw);
        if (dedupedStepLabels.length >= STEP_LABEL_VISIBLE) break;
      }

      const placeNested = Array.isArray(c.collection_places)
        ? c.collection_places
        : [];
      const place_count =
        placeNested.length > 0 ? Number(placeNested[0]?.count) || 0 : 0;
      const likeNested = Array.isArray(c.collection_likes)
        ? c.collection_likes
        : [];
      const like_count =
        likeNested.length > 0 ? Number(likeNested[0]?.count) || 0 : 0;
      const saveNested = Array.isArray(c.collection_saves)
        ? c.collection_saves
        : [];
      const save_count =
        saveNested.length > 0 ? Number(saveNested[0]?.count) || 0 : 0;

      return {
        id: c.id,
        title: c.title ?? null,
        cover_image_url: c.cover_image_url ?? null,
        vibe_caption:
          typeof c.vibe_caption === "string" ? c.vibe_caption : null,
        step_labels: dedupedStepLabels,
        tags: candidateTags,
        place_count,
        like_count,
        save_count,
        score,
        reason: reasonText,
        reason_kind: reasonKind,
        matched_tag: bestTagMatch,
        matched_step_label: bestStepMatch,
        matched_place_count: placeOverlapDistinct,
        is_featured_active: isFeaturedActiveRow(c),
        _tagScore: tagScore,
        _stepScore: stepScore,
        _placeOverlap: placeOverlapWeighted,
        _createdAtTs: c.created_at
          ? new Date(c.created_at).getTime() || 0
          : 0,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (a.is_featured_active !== b.is_featured_active) {
        return a.is_featured_active ? -1 : 1;
      }
      if (b.score !== a.score) return b.score - a.score;
      if (b._tagScore !== a._tagScore) return b._tagScore - a._tagScore;
      if (b._stepScore !== a._stepScore) return b._stepScore - a._stepScore;
      if (b._placeOverlap !== a._placeOverlap) {
        return b._placeOverlap - a._placeOverlap;
      }
      if (b.save_count !== a.save_count) return b.save_count - a.save_count;
      return b._createdAtTs - a._createdAtTs;
    })
    .slice(0, lim)
    .map((r) => {
      const out = { ...r };
      delete out._tagScore;
      delete out._stepScore;
      delete out._placeOverlap;
      delete out._createdAtTs;
      return out;
    });

  return {
    items: ranked,
    trending,
    recent_signal_save_count,
    signal_source,
  };
}

/**
 * 내 저장·좋아요·온보딩 태그 기반 컬렉션 추천 + (행동 시그널 있을 때) trending.
 *
 * @param {string} userId — `auth.users.id`
 * @param {{ limit?: number }} [opts] — `limit` 기본 8, 허용 범위 1~12
 * @returns {Promise<PersonalRecommendationResult>}
 */
export async function fetchMyTasteCollectionRecommendations(
  userId,
  { limit = 8 } = {},
) {
  const empty = {
    items: [],
    trending: null,
    recent_signal_save_count: 0,
    signal_source: null,
  };
  const uid = String(userId ?? "").trim();
  if (!uid || !UUID_RE.test(uid)) return empty;
  const lim = Math.min(Math.max(Math.floor(safeNumber(limit, 8)), 1), 12);
  const recentCutoffMs = Date.now() - RECENT_DAYS * 86400 * 1000;

  let ownIdSet = new Set();
  try {
    const { data: ownRows, error: ownErr } = await supabase
      .from("collections")
      .select("id")
      .eq("user_id", uid);
    if (ownErr) throw ownErr;
    ownIdSet = new Set(
      (Array.isArray(ownRows) ? ownRows : [])
        .map((r) => String(r?.id ?? "").trim())
        .filter(Boolean),
    );
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "fetchMyTasteCollectionRecommendations own ids:",
        e?.message || e,
      );
    }
  }

  /** @type {string[]} */
  let signalCollectionIds = [];
  /** collection_id → interaction created_at(ms) */
  const savedAtByCollection = new Map();
  let recentInteractionCount = 0;
  /** @type {'saves'|'likes'|null} */
  let behaviorKind = null;

  try {
    const { data, error } = await supabase
      .from("collection_saves")
      .select("collection_id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(RECENT_SAVES_POOL);
    if (error) throw error;
    const seen = new Set();
    for (const row of Array.isArray(data) ? data : []) {
      const cid = String(row?.collection_id ?? "").trim();
      if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      signalCollectionIds.push(cid);
      const ts = row?.created_at ? new Date(row.created_at).getTime() : 0;
      const safeTs = Number.isFinite(ts) ? ts : 0;
      savedAtByCollection.set(cid, safeTs);
      if (safeTs >= recentCutoffMs) recentInteractionCount += 1;
    }
    if (signalCollectionIds.length > 0) behaviorKind = "saves";
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "fetchMyTasteCollectionRecommendations saves:",
        e?.message || e,
      );
    }
  }

  if (signalCollectionIds.length === 0) {
    try {
      const { data, error } = await supabase
        .from("collection_likes")
        .select("collection_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(RECENT_SAVES_POOL);
      if (error) throw error;
      const seen = new Set();
      for (const row of Array.isArray(data) ? data : []) {
        const cid = String(row?.collection_id ?? "").trim();
        if (!cid || seen.has(cid)) continue;
        seen.add(cid);
        signalCollectionIds.push(cid);
        const ts = row?.created_at ? new Date(row.created_at).getTime() : 0;
        const safeTs = Number.isFinite(ts) ? ts : 0;
        savedAtByCollection.set(cid, safeTs);
        if (safeTs >= recentCutoffMs) recentInteractionCount += 1;
      }
      if (signalCollectionIds.length > 0) behaviorKind = "likes";
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "fetchMyTasteCollectionRecommendations likes:",
          e?.message || e,
        );
      }
    }
  }

  if (signalCollectionIds.length === 0) {
    let prefTags = [];
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("preference_tags")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      prefTags = dedupeAndNormalizeCollectionTags(data?.preference_tags);
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "fetchMyTasteCollectionRecommendations preference_tags:",
          e?.message || e,
        );
      }
    }
    if (prefTags.length === 0) return empty;

    const tagFreq = new Map();
    for (const t of prefTags) {
      const norm = normalizeCollectionTag(t);
      if (!norm) continue;
      const k = norm.toLowerCase();
      tagFreq.set(k, {
        raw: norm,
        recentCount: 0,
        totalCount: 1,
        weighted: RECENT_WEIGHT * 0 + CUM_WEIGHT * 1,
      });
    }
    if (tagFreq.size === 0) return empty;

    const excludeIds = new Set([...ownIdSet]);
    return finalizePersonalRecommendationsFromFreqMaps({
      lim,
      tagFreq,
      stepFreq: new Map(),
      myPlaceIds: new Set(),
      myRecentPlaceIds: new Set(),
      excludeIds,
      trending: null,
      recent_signal_save_count: 0,
      signal_source: "preference",
      reasonMode: "preference",
    });
  }

  const reasonMode = behaviorKind === "likes" ? "like" : "save";

  const [savedTagsRes, savedPlacesRes] = await Promise.all([
    supabase
      .from("collections")
      .select("id, tags")
      .in("id", signalCollectionIds),
    supabase
      .from("collection_places")
      .select("collection_id, place_id, step_label")
      .in("collection_id", signalCollectionIds),
  ]);

  if (savedTagsRes.error && import.meta?.env?.DEV) {
    console.warn(
      "fetchMyTasteCollectionRecommendations signal tags:",
      savedTagsRes.error.message,
    );
  }
  if (savedPlacesRes.error && import.meta?.env?.DEV) {
    console.warn(
      "fetchMyTasteCollectionRecommendations signal places:",
      savedPlacesRes.error.message,
    );
  }

  const excludeIds = new Set([...signalCollectionIds, ...ownIdSet]);

  /** lower-case norm → FreqEntry */
  const tagFreq = new Map();
  for (const row of Array.isArray(savedTagsRes.data) ? savedTagsRes.data : []) {
    const cid = String(row?.id ?? "").trim();
    const ts = savedAtByCollection.get(cid) ?? 0;
    const isRecent = ts >= recentCutoffMs;
    const tags = dedupeAndNormalizeCollectionTags(row?.tags);
    for (const t of tags) {
      const norm = normalizeCollectionTag(t);
      if (!norm) continue;
      const k = norm.toLowerCase();
      let entry = tagFreq.get(k);
      if (!entry) {
        entry = { raw: norm, recentCount: 0, totalCount: 0, weighted: 0 };
        tagFreq.set(k, entry);
      }
      entry.totalCount += 1;
      if (isRecent) entry.recentCount += 1;
    }
  }

  /** lower-case norm → FreqEntry */
  const stepFreq = new Map();
  /** 내 저장 컬렉션이 포함하는 place_id 집합 (전체) */
  const myPlaceIds = new Set();
  /** 최근 7일 저장 컬렉션의 place_id 집합 (recent boost 용) */
  const myRecentPlaceIds = new Set();
  for (const row of Array.isArray(savedPlacesRes.data)
    ? savedPlacesRes.data
    : []) {
    const cid = String(row?.collection_id ?? "").trim();
    const ts = savedAtByCollection.get(cid) ?? 0;
    const isRecent = ts >= recentCutoffMs;

    const lblRaw =
      typeof row?.step_label === "string" ? row.step_label.trim() : "";
    const norm = normStepLabel(lblRaw);
    if (norm) {
      let entry = stepFreq.get(norm);
      if (!entry) {
        entry = { raw: lblRaw, recentCount: 0, totalCount: 0, weighted: 0 };
        stepFreq.set(norm, entry);
      }
      entry.totalCount += 1;
      if (isRecent) entry.recentCount += 1;
    }

    const pid = String(row?.place_id ?? "").trim();
    if (pid && UUID_RE.test(pid)) {
      myPlaceIds.add(pid);
      if (isRecent) myRecentPlaceIds.add(pid);
    }
  }

  // 가중치 계산: weighted = 0.6·recent + 0.4·total
  // (최근 저장은 total 에도 포함되므로 부스트 효과)
  for (const v of tagFreq.values()) {
    v.weighted = RECENT_WEIGHT * v.recentCount + CUM_WEIGHT * v.totalCount;
  }
  for (const v of stepFreq.values()) {
    v.weighted = RECENT_WEIGHT * v.recentCount + CUM_WEIGHT * v.totalCount;
  }

  const topTagsProbe = [...tagFreq.values()]
    .filter((t) => t.weighted > 0)
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, TOP_TAG_PICK);
  const topStepsProbe = [...stepFreq.values()]
    .filter((s) => s.weighted > 0)
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, TOP_STEP_PICK);

  if (
    topTagsProbe.length === 0 &&
    topStepsProbe.length === 0 &&
    myPlaceIds.size === 0
  ) {
    return empty;
  }

  const trending = pickTrendingHint(tagFreq, stepFreq);

  return finalizePersonalRecommendationsFromFreqMaps({
    lim,
    tagFreq,
    stepFreq,
    myPlaceIds,
    myRecentPlaceIds,
    excludeIds,
    trending,
    recent_signal_save_count: recentInteractionCount,
    signal_source: behaviorKind,
    reasonMode,
  });
}

/**
 * 최근 저장 시그널이 두드러지는 항목을 한 개 골라 trending hint 로 반환.
 *
 * 우선 tag, 그 다음 step. 동률이면 `recent_share` 가 더 큰 쪽이 이긴다.
 * `recent_share = recentCount / totalCount` 으로, "최근 N일이 차지하는 비중" 을 의미.
 *
 * @param {Map<string, { raw: string, recentCount: number, totalCount: number, weighted: number }>} tagMap
 * @param {Map<string, { raw: string, recentCount: number, totalCount: number, weighted: number }>} stepMap
 * @returns {PersonalRecommendationTrendingHint | null}
 */
function pickTrendingHint(tagMap, stepMap) {
  const bestTag = pickBestRecent(tagMap);
  const bestStep = pickBestRecent(stepMap);

  if (!bestTag && !bestStep) return null;
  if (bestTag && !bestStep) {
    return makeTrendingHint("tag", bestTag);
  }
  if (!bestTag && bestStep) {
    return makeTrendingHint("step", bestStep);
  }
  // 둘 다 있을 때: recent_count 가 큰 쪽 우선, 동률이면 recent_share 큰 쪽.
  if (bestTag.recentCount !== bestStep.recentCount) {
    return makeTrendingHint(
      bestTag.recentCount > bestStep.recentCount ? "tag" : "step",
      bestTag.recentCount > bestStep.recentCount ? bestTag : bestStep,
    );
  }
  const tagShare = bestTag.recentCount / Math.max(1, bestTag.totalCount);
  const stepShare = bestStep.recentCount / Math.max(1, bestStep.totalCount);
  if (tagShare >= stepShare) return makeTrendingHint("tag", bestTag);
  return makeTrendingHint("step", bestStep);
}

function pickBestRecent(freqMap) {
  let best = null;
  for (const v of freqMap.values()) {
    if (v.recentCount < TRENDING_MIN_RECENT) continue;
    if (!best) {
      best = v;
      continue;
    }
    const curShare = v.recentCount / Math.max(1, v.totalCount);
    const bestShare = best.recentCount / Math.max(1, best.totalCount);
    if (curShare > bestShare + 1e-9) {
      best = v;
    } else if (Math.abs(curShare - bestShare) < 1e-9) {
      if (v.recentCount > best.recentCount) best = v;
    }
  }
  return best;
}

function makeTrendingHint(kind, entry) {
  const total = Math.max(1, entry.totalCount);
  return {
    kind,
    label: entry.raw,
    recent_count: entry.recentCount,
    total_count: entry.totalCount,
    recent_share: entry.recentCount / total,
  };
}
