import { supabase } from "./client";

/**
 * 컬렉션 상세 하단용 "비슷한 코스" 추천.
 *
 * 검색·지도 파이프라인과 무관하게 동작하는 lightweight collaborative + content
 * 휴리스틱이다. 모든 보조 fetch 는 best-effort 로 실패해도 빈 배열을 반환한다.
 *
 * 점수 = 3·placeOverlap + 2·stepLabelOverlap + 4·coSaveUserOverlap
 *  - placeOverlap        : 같은 `places.id` 가 양쪽 컬렉션에 등장한 횟수
 *  - stepLabelOverlap    : `step_label` (lowercased trim) 교집합 크기
 *  - coSaveUserOverlap   : 원본 컬렉션을 저장한 유저 중 후보 컬렉션도 저장한 유저 수
 *
 * 필요 SELECT 권한:
 *  - `collections` (visibility='public' 자동 필터)
 *  - `collection_places` (FK SELECT 허용)
 *  - `collection_saves` (공개 컬렉션 한정 누구나 SELECT, RLS 가 처리)
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOURCE_SAVER_LIMIT = 300;
const CANDIDATE_PLACE_FETCH_LIMIT = 4000;
const CANDIDATE_SAVE_FETCH_LIMIT = 4000;
const HARD_CANDIDATE_LIMIT = 80;
const STEP_LABEL_VISIBLE = 3;

const W_PLACE = 3;
const W_STEP = 2;
const W_USER = 4;

function safeNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normalizeStepLabel(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

/**
 * 컬렉션 한 건과 비슷한 공개 컬렉션 추천.
 *
 * @param {string} collectionId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{
 *   id: string,
 *   title: string | null,
 *   cover_image_url: string | null,
 *   vibe_caption: string | null,
 *   step_labels: string[],
 *   place_count: number,
 *   save_count: number,
 *   score: number,
 *   reasons: string[],
 *   tags: string[],
 * }>>}
 */
export async function fetchSimilarCollections(collectionId, { limit = 6 } = {}) {
  const cid = String(collectionId ?? "").trim();
  if (!cid || !UUID_RE.test(cid)) return [];
  const lim = Math.min(Math.max(Math.floor(safeNumber(limit, 6)), 1), 12);

  /** placeId → 표시명 (없으면 ""). 점수 계산은 ID 기반, UI 표시는 이름 기반. */
  const sourcePlaceNameById = new Map();
  /** norm step_label → 원형(첫 등장) — 후보 매칭은 norm 으로, 표시는 원형으로. */
  const sourceStepRawByNorm = new Map();
  /** order_index 오름차순 정렬된 source 스텝(중복 norm 제거). */
  const sourceStepLabelsOrdered = [];
  try {
    const { data, error } = await supabase
      .from("collection_places")
      .select(
        "place_id, step_label, order_index, places!collection_places_place_id_fkey(name)",
      )
      .eq("collection_id", cid);
    if (error) throw error;
    const stepRowsForOrder = [];
    for (const row of Array.isArray(data) ? data : []) {
      const pid = String(row?.place_id ?? "").trim();
      if (pid) {
        const nm =
          typeof row?.places?.name === "string" ? row.places.name.trim() : "";
        if (!sourcePlaceNameById.has(pid)) {
          sourcePlaceNameById.set(pid, nm);
        }
      }
      const norm = normalizeStepLabel(row?.step_label);
      const raw =
        typeof row?.step_label === "string" ? row.step_label.trim() : "";
      if (norm && raw) {
        if (!sourceStepRawByNorm.has(norm)) {
          sourceStepRawByNorm.set(norm, raw);
        }
        stepRowsForOrder.push({
          norm,
          raw,
          order: safeNumber(row?.order_index, 0),
        });
      }
    }
    stepRowsForOrder.sort((a, b) => a.order - b.order);
    const seen = new Set();
    for (const s of stepRowsForOrder) {
      if (seen.has(s.norm)) continue;
      seen.add(s.norm);
      sourceStepLabelsOrdered.push(s);
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchSimilarCollections source places:", e?.message || e);
    }
  }

  const sourceSaverIds = new Set();
  try {
    const { data, error } = await supabase
      .from("collection_saves")
      .select("user_id")
      .eq("collection_id", cid)
      .order("created_at", { ascending: false })
      .limit(SOURCE_SAVER_LIMIT);
    if (error) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const uid = String(row?.user_id ?? "").trim();
      if (uid) sourceSaverIds.add(uid);
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchSimilarCollections source savers:", e?.message || e);
    }
  }

  const candidateIdSet = new Set();

  const sourcePlaceIds = [...sourcePlaceNameById.keys()];
  if (sourcePlaceIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from("collection_places")
        .select("collection_id")
        .in("place_id", sourcePlaceIds)
        .neq("collection_id", cid)
        .limit(CANDIDATE_PLACE_FETCH_LIMIT);
      if (error) throw error;
      for (const row of Array.isArray(data) ? data : []) {
        const id = String(row?.collection_id ?? "").trim();
        if (id && id !== cid) candidateIdSet.add(id);
        if (candidateIdSet.size >= HARD_CANDIDATE_LIMIT) break;
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "fetchSimilarCollections candidates by place:",
          e?.message || e,
        );
      }
    }
  }

  if (sourceSaverIds.size > 0 && candidateIdSet.size < HARD_CANDIDATE_LIMIT) {
    try {
      const { data, error } = await supabase
        .from("collection_saves")
        .select("collection_id")
        .in("user_id", [...sourceSaverIds])
        .neq("collection_id", cid)
        .limit(CANDIDATE_SAVE_FETCH_LIMIT);
      if (error) throw error;
      for (const row of Array.isArray(data) ? data : []) {
        const id = String(row?.collection_id ?? "").trim();
        if (id && id !== cid) candidateIdSet.add(id);
        if (candidateIdSet.size >= HARD_CANDIDATE_LIMIT) break;
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn(
          "fetchSimilarCollections candidates by saver:",
          e?.message || e,
        );
      }
    }
  }

  if (candidateIdSet.size === 0) return [];

  const candidateIds = [...candidateIdSet];

  let publicCollections = [];
  try {
    const { data, error } = await supabase
      .from("collections")
      .select("id, title, cover_image_url, vibe_caption, visibility, tags")
      .in("id", candidateIds)
      .eq("visibility", "public");
    if (error) throw error;
    publicCollections = Array.isArray(data) ? data : [];
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "fetchSimilarCollections candidate collections:",
        e?.message || e,
      );
    }
    return [];
  }

  if (publicCollections.length === 0) return [];

  const publicIds = publicCollections.map((c) => c.id);

  const placesByCollection = new Map();
  try {
    const { data, error } = await supabase
      .from("collection_places")
      .select(
        "collection_id, place_id, step_label, order_index, places!collection_places_place_id_fkey(name)",
      )
      .in("collection_id", publicIds);
    if (error) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.collection_id ?? "").trim();
      if (!id) continue;
      let bag = placesByCollection.get(id);
      if (!bag) {
        bag = { placeIds: [], placeNameById: new Map(), steps: [] };
        placesByCollection.set(id, bag);
      }
      const pid = String(row?.place_id ?? "").trim();
      if (pid) {
        bag.placeIds.push(pid);
        const nm =
          typeof row?.places?.name === "string" ? row.places.name.trim() : "";
        if (nm && !bag.placeNameById.has(pid)) {
          bag.placeNameById.set(pid, nm);
        }
      }
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
        "fetchSimilarCollections candidate places:",
        e?.message || e,
      );
    }
  }

  const saveCountByCollection = new Map();
  const userOverlapByCollection = new Map();
  try {
    const { data, error } = await supabase
      .from("collection_saves")
      .select("collection_id, user_id")
      .in("collection_id", publicIds);
    if (error) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.collection_id ?? "").trim();
      if (!id) continue;
      saveCountByCollection.set(
        id,
        (saveCountByCollection.get(id) || 0) + 1,
      );
      const uid = String(row?.user_id ?? "").trim();
      if (uid && sourceSaverIds.has(uid)) {
        userOverlapByCollection.set(
          id,
          (userOverlapByCollection.get(id) || 0) + 1,
        );
      }
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn(
        "fetchSimilarCollections candidate saves:",
        e?.message || e,
      );
    }
  }

  const ranked = publicCollections
    .map((c) => {
      const bag =
        placesByCollection.get(c.id) || {
          placeIds: [],
          placeNameById: new Map(),
          steps: [],
        };

      const overlapPlaceNames = [];
      const seenPlace = new Set();
      for (const pid of bag.placeIds) {
        if (seenPlace.has(pid)) continue;
        seenPlace.add(pid);
        if (!sourcePlaceNameById.has(pid)) continue;
        const nm =
          sourcePlaceNameById.get(pid) || bag.placeNameById.get(pid) || "";
        overlapPlaceNames.push(nm);
      }
      const placeOverlap = overlapPlaceNames.length;

      const candidateStepNorms = new Set();
      for (const s of bag.steps) candidateStepNorms.add(s.norm);
      const overlapStepLabelsOrdered = [];
      for (const s of sourceStepLabelsOrdered) {
        if (candidateStepNorms.has(s.norm)) {
          overlapStepLabelsOrdered.push(s.raw);
        }
      }
      const stepOverlap = overlapStepLabelsOrdered.length;

      const userOverlap = userOverlapByCollection.get(c.id) || 0;
      const score =
        W_PLACE * placeOverlap + W_STEP * stepOverlap + W_USER * userOverlap;

      const sortedSteps = [...bag.steps]
        .sort((a, b) => a.order - b.order)
        .map((s) => s.raw);
      const dedupedSteps = [];
      const seenLabel = new Set();
      for (const lbl of sortedSteps) {
        const k = lbl.toLowerCase();
        if (seenLabel.has(k)) continue;
        seenLabel.add(k);
        dedupedSteps.push(lbl);
        if (dedupedSteps.length >= STEP_LABEL_VISIBLE) break;
      }

      return {
        id: c.id,
        title: c.title ?? null,
        cover_image_url: c.cover_image_url ?? null,
        vibe_caption:
          typeof c.vibe_caption === "string" ? c.vibe_caption : null,
        step_labels: dedupedSteps,
        place_count: bag.placeIds.length,
        save_count: saveCountByCollection.get(c.id) || 0,
        score,
        overlap_place_names: overlapPlaceNames,
        overlap_step_labels: overlapStepLabelsOrdered,
        user_overlap_count: userOverlap,
        // 상황 태그는 metadata 로만 노출 — score 계산에는 사용하지 않는다.
        tags: Array.isArray(c.tags) ? [...c.tags] : [],
        _placeOverlap: placeOverlap,
        _stepOverlap: stepOverlap,
        _userOverlap: userOverlap,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b._userOverlap !== a._userOverlap) {
        return b._userOverlap - a._userOverlap;
      }
      if (b._placeOverlap !== a._placeOverlap) {
        return b._placeOverlap - a._placeOverlap;
      }
      return b.save_count - a.save_count;
    })
    .slice(0, lim)
    .map((r) => {
      const out = { ...r };
      delete out._placeOverlap;
      delete out._stepOverlap;
      delete out._userOverlap;
      return out;
    });

  return ranked;
}
