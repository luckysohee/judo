import { dedupeAndNormalizeCollectionTags } from "../utils/collectionTags";
import { supabase } from "./client";

/**
 * 컬렉션(코스) 자체를 키워드로 검색하는 lightweight 모듈.
 *
 * - 기존 장소 검색 / `useCourseSearch` / `MapView` 와 무관하게 독립 동작.
 * - PostgREST 만 사용. RPC·풀텍스트 인덱스 없이 단순 ilike + tags overlap 조합.
 * - 모든 결과는 `visibility='public'` 한정.
 *
 * 매칭 소스(가중치):
 *  1. `collections.title` ilike        → 5
 *  2. `collections.tags` overlap       → 3
 *  3. `collections.vibe_caption` ilike → 2
 *  4. `collection_places.step_label` ilike → 1
 *
 * 동률은 `save_count` → `like_count` → 최신 순으로 깬다(holistic / featured 우선).
 *
 * `vibe_caption` 매칭은 신규 — "비 오는 날 / 새벽 감성 / 조용한" 같은 분위기 토큰을
 * 자연어 그대로 받기 위해 title 보다 약하고 tag 보다도 약한 보조 시그널로 둔다.
 * 추천/`useCourseSearch` 와는 무관하다.
 */

const TITLE_WEIGHT = 5;
const TAG_WEIGHT = 3;
const VIBE_WEIGHT = 2;
const STEP_WEIGHT = 1;

const COLLECTION_COLUMNS_FOR_SEARCH = `
  id, user_id, title, description, visibility, cover_image_url, vibe_caption,
  created_at, updated_at, is_featured, featured_rank, featured_until, tags,
  collection_places(count),
  collection_likes(count),
  collection_saves(count)
`;

/**
 * 입력 쿼리를 토큰화한다. 한글 단어는 그대로 두고, 공백 / 콤마 / `#` 만 분리.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeCollectionSearchQuery(query) {
  if (typeof query !== "string") return [];
  const out = [];
  const seen = new Set();
  for (const raw of query.split(/[\s,#]+/g)) {
    const t = raw.trim();
    if (!t) continue;
    if (t.length > 32) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 6);
}

/**
 * PostgREST `ilike` 값에 들어가는 메타 문자(%, _, \) 를 escape.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeIlike(value) {
  return String(value).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function unwrap(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  const placesNested = Array.isArray(out.collection_places)
    ? out.collection_places
    : [];
  out.place_count =
    placesNested.length > 0 ? Number(placesNested[0]?.count) || 0 : 0;
  delete out.collection_places;
  const likesNested = Array.isArray(out.collection_likes)
    ? out.collection_likes
    : [];
  out.like_count =
    likesNested.length > 0 ? Number(likesNested[0]?.count) || 0 : 0;
  delete out.collection_likes;
  const savesNested = Array.isArray(out.collection_saves)
    ? out.collection_saves
    : [];
  out.save_count =
    savesNested.length > 0 ? Number(savesNested[0]?.count) || 0 : 0;
  delete out.collection_saves;
  return out;
}

/**
 * 키워드로 공개 컬렉션을 검색.
 *
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{
 *   id: string,
 *   title: string | null,
 *   cover_image_url: string | null,
 *   vibe_caption: string | null,
 *   tags: string[] | null,
 *   place_count: number,
 *   like_count: number,
 *   save_count: number,
 *   step_labels: string[],
 *   match_sources: string[],
 *   matched_vibe_tokens: string[],
 * }>>}
 */
export async function searchCollections(query, { limit = 24 } = {}) {
  const tokens = tokenizeCollectionSearchQuery(query);
  if (tokens.length === 0) return [];
  const lim = Math.min(Math.max(Math.floor(Number(limit) || 24), 1), 60);

  const titleIds = new Set();
  const tagIds = new Set();
  const vibeIds = new Set();
  const stepIds = new Set();
  /** @type {Map<string, Set<string>>} cid → 매칭된 토큰 모음(vibe 강조용 표시 데이터). */
  const matchedVibeTokensByCid = new Map();

  /** 토큰별 title ilike — 동시에 병렬로 발사. */
  const titleProbes = tokens.map(async (t) => {
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("id")
        .eq("visibility", "public")
        .ilike("title", `%${escapeIlike(t)}%`)
        .limit(40);
      if (error) throw error;
      for (const r of data ?? []) titleIds.add(r.id);
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("searchCollections title:", e?.message || e);
      }
    }
  });

  /** tags overlap 은 한 번에 처리. 토큰을 정규화한 형태와 동일해야 매칭됨. */
  const tagsCleaned = dedupeAndNormalizeCollectionTags(tokens);
  const tagsProbe = (async () => {
    if (tagsCleaned.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("id")
        .eq("visibility", "public")
        .overlaps("tags", tagsCleaned)
        .limit(60);
      if (error) throw error;
      for (const r of data ?? []) tagIds.add(r.id);
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("searchCollections tags:", e?.message || e);
      }
    }
  })();

  /** vibe_caption ilike — 한 줄 무드 자연어 매칭. 토큰별 매칭 cid 기록. */
  const vibeProbes = tokens.map(async (t) => {
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("id")
        .eq("visibility", "public")
        .ilike("vibe_caption", `%${escapeIlike(t)}%`)
        .limit(40);
      if (error) throw error;
      for (const r of data ?? []) {
        if (!r?.id) continue;
        vibeIds.add(r.id);
        let bag = matchedVibeTokensByCid.get(r.id);
        if (!bag) {
          bag = new Set();
          matchedVibeTokensByCid.set(r.id, bag);
        }
        bag.add(t);
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("searchCollections vibe:", e?.message || e);
      }
    }
  });

  /** step_label ilike — collection_places 에서 collection_id 만 회수. */
  const stepProbes = tokens.map(async (t) => {
    try {
      const { data, error } = await supabase
        .from("collection_places")
        .select("collection_id")
        .ilike("step_label", `%${escapeIlike(t)}%`)
        .limit(80);
      if (error) throw error;
      for (const r of data ?? []) {
        if (r?.collection_id) stepIds.add(r.collection_id);
      }
    } catch (e) {
      if (import.meta?.env?.DEV) {
        console.warn("searchCollections step:", e?.message || e);
      }
    }
  });

  await Promise.all([
    ...titleProbes,
    tagsProbe,
    ...vibeProbes,
    ...stepProbes,
  ]);

  const allIds = new Set([...titleIds, ...tagIds, ...vibeIds, ...stepIds]);
  if (allIds.size === 0) return [];

  /** 후보 컬렉션 풀 fetch (visibility=public RLS 와 conditional eq 가 안전망). */
  const candidates = [...allIds];
  let rows = [];
  try {
    const { data, error } = await supabase
      .from("collections")
      .select(COLLECTION_COLUMNS_FOR_SEARCH)
      .in("id", candidates)
      .eq("visibility", "public")
      .limit(Math.min(120, lim * 4));
    if (error) throw error;
    rows = (Array.isArray(data) ? data : []).map(unwrap);
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("searchCollections rows:", e?.message || e);
    }
    return [];
  }

  if (rows.length === 0) return [];

  /** 각 컬렉션의 대표 step_label (order_index 오름차순 dedup top 3) — 별도 fetch. */
  const stepLabelsByCid = new Map();
  try {
    const { data, error } = await supabase
      .from("collection_places")
      .select("collection_id, step_label, order_index")
      .in(
        "collection_id",
        rows.map((r) => r.id),
      )
      .not("step_label", "is", null)
      .order("collection_id", { ascending: true })
      .order("order_index", { ascending: true })
      .limit(rows.length * 6);
    if (error) throw error;
    for (const r of data ?? []) {
      const cid = r?.collection_id;
      const label = typeof r?.step_label === "string" ? r.step_label.trim() : "";
      if (!cid || !label) continue;
      const existing = stepLabelsByCid.get(cid) || [];
      const norm = label.toLowerCase();
      if (existing.some((x) => x.toLowerCase() === norm)) continue;
      if (existing.length >= 3) continue;
      existing.push(label);
      stepLabelsByCid.set(cid, existing);
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("searchCollections step_labels:", e?.message || e);
    }
  }

  const ranked = rows
    .map((r) => {
      const sources = [];
      let score = 0;
      if (titleIds.has(r.id)) {
        score += TITLE_WEIGHT;
        sources.push("title");
      }
      if (tagIds.has(r.id)) {
        score += TAG_WEIGHT;
        sources.push("tags");
      }
      if (vibeIds.has(r.id)) {
        score += VIBE_WEIGHT;
        sources.push("vibe");
      }
      if (stepIds.has(r.id)) {
        score += STEP_WEIGHT;
        sources.push("step_label");
      }
      const matchedVibeTokens = matchedVibeTokensByCid.has(r.id)
        ? Array.from(matchedVibeTokensByCid.get(r.id))
        : [];
      return {
        ...r,
        step_labels: stepLabelsByCid.get(r.id) || [],
        match_sources: sources,
        matched_vibe_tokens: matchedVibeTokens,
        _score: score,
      };
    })
    .filter((r) => r._score > 0);

  ranked.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    const ds = Number(b.save_count || 0) - Number(a.save_count || 0);
    if (ds !== 0) return ds;
    const dl = Number(b.like_count || 0) - Number(a.like_count || 0);
    if (dl !== 0) return dl;
    const bt = new Date(b.created_at || 0).getTime();
    const at = new Date(a.created_at || 0).getTime();
    return bt - at;
  });

  return ranked.slice(0, lim).map((r) => {
    const out = { ...r };
    delete out._score;
    return out;
  });
}
