import { dedupeAndNormalizeCollectionTags } from "../utils/collectionTags";
import { supabase } from "./client";

/**
 * 컬렉션 검색의 "인기 검색어" — lightweight heuristic.
 *
 * - 검색 score / 정렬 / `searchCollections` 와 무관한 별개 fetch.
 * - `collection_interaction_logs` 는 `collection_id` 만 기록하고 query 문자열을
 *   저장하지 않으므로, 진짜 "검색어 빈도" 는 추출할 수 없다. 대신 공개 컬렉션 중
 *   최근/저장 인기 행의 `tags` 빈도 분포 + 운영자 추천을 가벼운 proxy 로 사용한다.
 * - 데이터가 비어 있거나 fetch 가 실패하면 호출자가 fallback 목록을 그대로 보이도록
 *   빈 배열을 반환한다.
 */

const TAG_FETCH_LIMIT = 80;
const TAG_RESULT_LIMIT = 6;
const MIN_TAG_LEN = 1;
const MAX_TAG_LEN = 20;

/**
 * 인기 태그(=검색어 후보) 목록을 반환.
 *
 * 매칭 풀: 공개 + 활성 featured 우선 + 최근 created/updated 행 위주(저장 카운트는
 * 가져오기 위해 추가 join 까지 가지 않고, 최근 80개의 분포로 근사).
 *
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<string[]>}
 */
export async function fetchPopularCollectionSearchTags({ limit = TAG_RESULT_LIMIT } = {}) {
  const cap = Math.min(Math.max(Math.floor(Number(limit) || TAG_RESULT_LIMIT), 1), 12);

  let rows = [];
  try {
    const { data, error } = await supabase
      .from("collections")
      .select("tags, is_featured, featured_until, updated_at")
      .eq("visibility", "public")
      .not("tags", "is", null)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(TAG_FETCH_LIMIT);
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchPopularCollectionSearchTags:", e?.message || e);
    }
    return [];
  }

  /** 빈도 + featured 가중치(가중치 작게 — 1.5 배). */
  const counters = new Map();
  const display = new Map();

  for (const row of rows) {
    const cleaned = dedupeAndNormalizeCollectionTags(row?.tags);
    if (cleaned.length === 0) continue;
    const featuredActive =
      row?.is_featured === true &&
      (!row?.featured_until ||
        new Date(row.featured_until).getTime() > Date.now());
    const weight = featuredActive ? 1.5 : 1;
    for (const t of cleaned) {
      if (t.length < MIN_TAG_LEN || t.length > MAX_TAG_LEN) continue;
      const key = t.toLowerCase();
      counters.set(key, (counters.get(key) || 0) + weight);
      if (!display.has(key)) display.set(key, t);
    }
  }

  if (counters.size === 0) return [];

  return [...counters.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([key]) => display.get(key) || key);
}
