import { supabase } from "./client";
import {
  dedupeAndNormalizeCollectionTags,
  normalizeCollectionTag,
} from "../utils/collectionTags";

/**
 * "이 사람의 술 취향" — 사용자의 공개 컬렉션 + 좋아요 + 저장 기록을 합쳐
 * 가장 자주 등장하는 tag · step_label · 지역(동/구) 을 추출.
 *
 * 검색·지도·`useCourseSearch` 와 무관하게 단독으로 동작하는 lightweight heuristic.
 * 운영 데이터가 적어도 자연스럽게 빈 값이 떨어지도록 모든 보조 fetch 는 best-effort
 * 로 실패해도 다른 시그널은 그대로 진행한다.
 *
 * 시그널 소스(세 가지를 합집합으로 처리, RLS 가 자연스럽게 비공개를 가린다):
 *  - `collections` (공개 + 본인 행)              : "내가 만든 코스"
 *  - `collection_saves`                          : "내가 라이브러리에 담은 코스"
 *  - `collection_likes`                          : "내가 좋아요한 코스"
 *
 * 요약 copy 예: `"야장 · 노포 · 을지로 러버"` — 상위 태그 2개 + 상위 지역 1개.
 *
 * 필요 SELECT 권한:
 *  - `collections`        (RLS: 공개 또는 본인)
 *  - `collection_saves`   (RLS: 공개 컬렉션 행 또는 본인 행)
 *  - `collection_likes`   (RLS: 공개 컬렉션 행 또는 본인 행)
 *  - `collection_places`  (FK SELECT — 부모 collections RLS 통과 시)
 *  - `places`             (장소 메타 anon 가능)
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PER_SOURCE_LIMIT = 30;
const TOP_TAG_OUT = 5;
const TOP_STEP_OUT = 4;
const TOP_REGION_OUT = 3;
const SUMMARY_MAX_PARTS = 3;
/** 요약 copy 노출 최소 시그널 — 너무 빈약한 데이터로 단정짓지 않기 위함. */
const SUMMARY_MIN_SOURCE_COLS = 2;

function safeNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * 한국 주소 텍스트에서 동·구 토큰을 추출.
 *
 * 예:
 *   "서울특별시 중구 을지로3가 12-3" → { display: "을지로", gu: "중구" }
 *   "경기도 수원시 영통구 영통동 123" → { display: "영통동", gu: "영통구" }
 *   "부산광역시 해운대구 우동 1404"   → { display: "우동", gu: "해운대구" }
 *
 * 동 토큰 끝의 숫자/접미("3가" "1동" 등)는 정규화로 제거.
 *
 * @param {string} addr
 * @returns {{ display: string, key: string, gu: string | null } | null}
 */
function extractRegionFromAddress(addr) {
  if (typeof addr !== "string") return null;
  const trimmed = addr.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return null;

  const cityRe = /(특별시|광역시|특별자치시|특별자치도|도)$/;
  const guRe = /(시|군|구)$/;

  let i = 0;
  if (tokens[i] && cityRe.test(tokens[i])) i += 1;
  let gu = null;
  while (i < tokens.length && tokens[i] && guRe.test(tokens[i])) {
    gu = tokens[i];
    i += 1;
  }
  const dongRaw =
    i < tokens.length && /[가-힣]/.test(tokens[i]) ? tokens[i] : null;

  let display = null;
  if (dongRaw) {
    // 끝의 "3가", "1동", "1로" 등 정규화. "신사동", "을지로" 는 보존.
    const cleaned = dongRaw.replace(/\d+(?:가|동|로|길)?$/, "").trim();
    display = cleaned.length > 0 ? cleaned : dongRaw;
  } else if (gu) {
    display = gu;
  } else {
    return null;
  }

  return {
    display,
    key: display.toLowerCase(),
    gu,
  };
}

/**
 * @typedef {{ raw: string, count: number }} TasteFreqEntry
 */

/**
 * @typedef {{
 *   has_signal: boolean,
 *   summary: string | null,
 *   summary_parts: string[],
 *   top_tags: TasteFreqEntry[],
 *   top_step_labels: TasteFreqEntry[],
 *   top_regions: TasteFreqEntry[],
 *   source_collection_count: number,
 * }} UserTasteProfile
 */

/**
 * 특정 사용자의 취향 요약.
 *
 * @param {string} targetUserId — `auth.users.id`
 * @returns {Promise<UserTasteProfile>}
 */
export async function fetchUserTasteProfile(targetUserId) {
  const empty = {
    has_signal: false,
    summary: null,
    summary_parts: [],
    top_tags: [],
    top_step_labels: [],
    top_regions: [],
    source_collection_count: 0,
  };

  const uid = String(targetUserId ?? "").trim();
  if (!uid || !UUID_RE.test(uid)) return empty;

  // 1. 세 소스에서 collection_id 풀 수집.
  const sourceColIdSet = new Set();
  try {
    const [ownRes, saveRes, likeRes] = await Promise.all([
      supabase
        .from("collections")
        .select("id")
        .eq("user_id", uid)
        .eq("visibility", "public"),
      supabase
        .from("collection_saves")
        .select("collection_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE_LIMIT),
      supabase
        .from("collection_likes")
        .select("collection_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(PER_SOURCE_LIMIT),
    ]);

    if (ownRes.error && import.meta?.env?.DEV) {
      console.warn(
        "fetchUserTasteProfile own cols:",
        ownRes.error.message,
      );
    }
    if (saveRes.error && import.meta?.env?.DEV) {
      console.warn(
        "fetchUserTasteProfile saves:",
        saveRes.error.message,
      );
    }
    if (likeRes.error && import.meta?.env?.DEV) {
      console.warn(
        "fetchUserTasteProfile likes:",
        likeRes.error.message,
      );
    }

    for (const row of Array.isArray(ownRes.data) ? ownRes.data : []) {
      const id = String(row?.id ?? "").trim();
      if (id) sourceColIdSet.add(id);
    }
    for (const row of Array.isArray(saveRes.data) ? saveRes.data : []) {
      const id = String(row?.collection_id ?? "").trim();
      if (id) sourceColIdSet.add(id);
    }
    for (const row of Array.isArray(likeRes.data) ? likeRes.data : []) {
      const id = String(row?.collection_id ?? "").trim();
      if (id) sourceColIdSet.add(id);
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchUserTasteProfile sources:", e?.message || e);
    }
    return empty;
  }

  if (sourceColIdSet.size === 0) return empty;

  const sourceColIds = [...sourceColIdSet];

  // 2. 후보 컬렉션의 tag 메타 + collection_places(places.address) 동시 fetch.
  const tagFreq = new Map();
  const stepFreq = new Map();
  const regionFreq = new Map();

  try {
    const [tagsRes, placesRes] = await Promise.all([
      supabase.from("collections").select("id, tags").in("id", sourceColIds),
      supabase
        .from("collection_places")
        .select(
          "collection_id, step_label, places!collection_places_place_id_fkey(address)",
        )
        .in("collection_id", sourceColIds),
    ]);

    if (tagsRes.error && import.meta?.env?.DEV) {
      console.warn(
        "fetchUserTasteProfile tags meta:",
        tagsRes.error.message,
      );
    }
    if (placesRes.error && import.meta?.env?.DEV) {
      console.warn(
        "fetchUserTasteProfile places meta:",
        placesRes.error.message,
      );
    }

    for (const row of Array.isArray(tagsRes.data) ? tagsRes.data : []) {
      const tags = dedupeAndNormalizeCollectionTags(row?.tags);
      const seenInCol = new Set();
      for (const t of tags) {
        const norm = normalizeCollectionTag(t);
        if (!norm) continue;
        const k = norm.toLowerCase();
        if (seenInCol.has(k)) continue;
        seenInCol.add(k);
        let entry = tagFreq.get(k);
        if (!entry) {
          entry = { raw: norm, count: 0 };
          tagFreq.set(k, entry);
        }
        entry.count += 1;
      }
    }

    for (const row of Array.isArray(placesRes.data) ? placesRes.data : []) {
      const lblRaw =
        typeof row?.step_label === "string" ? row.step_label.trim() : "";
      if (lblRaw) {
        const k = lblRaw.toLowerCase();
        let entry = stepFreq.get(k);
        if (!entry) {
          entry = { raw: lblRaw, count: 0 };
          stepFreq.set(k, entry);
        }
        entry.count += 1;
      }

      const addr = row?.places?.address;
      const region = extractRegionFromAddress(addr);
      if (region) {
        let entry = regionFreq.get(region.key);
        if (!entry) {
          entry = { raw: region.display, count: 0, gu: region.gu ?? null };
          regionFreq.set(region.key, entry);
        }
        entry.count += 1;
      }
    }
  } catch (e) {
    if (import.meta?.env?.DEV) {
      console.warn("fetchUserTasteProfile meta:", e?.message || e);
    }
  }

  const topTags = [...tagFreq.values()]
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw))
    .slice(0, TOP_TAG_OUT);
  const topSteps = [...stepFreq.values()]
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw))
    .slice(0, TOP_STEP_OUT);
  const topRegions = [...regionFreq.values()]
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw))
    .slice(0, TOP_REGION_OUT);

  const sourceCount = sourceColIds.length;

  // 3. 요약 parts: 상위 태그 2개 → 상위 지역 1개 → 부족하면 추가 태그.
  const summaryParts = [];
  if (sourceCount >= SUMMARY_MIN_SOURCE_COLS) {
    for (const t of topTags.slice(0, 2)) {
      if (summaryParts.length >= SUMMARY_MAX_PARTS) break;
      summaryParts.push(t.raw);
    }
    if (
      summaryParts.length < SUMMARY_MAX_PARTS &&
      topRegions[0] &&
      topRegions[0].count >= 2
    ) {
      summaryParts.push(topRegions[0].raw);
    }
    if (summaryParts.length === 0 && topRegions[0]) {
      summaryParts.push(topRegions[0].raw);
    }
    if (summaryParts.length < SUMMARY_MAX_PARTS) {
      for (const t of topTags.slice(2)) {
        if (summaryParts.length >= SUMMARY_MAX_PARTS) break;
        summaryParts.push(t.raw);
      }
    }
  }

  const summary =
    summaryParts.length > 0 ? `${summaryParts.join(" · ")} 러버` : null;
  const hasSignal =
    Boolean(summary) ||
    topTags.length > 0 ||
    topSteps.length > 0 ||
    topRegions.length > 0;

  return {
    has_signal: hasSignal,
    summary,
    summary_parts: summaryParts,
    top_tags: topTags.map((t) => ({ raw: t.raw, count: safeNumber(t.count) })),
    top_step_labels: topSteps.map((s) => ({
      raw: s.raw,
      count: safeNumber(s.count),
    })),
    top_regions: topRegions.map((r) => ({
      raw: r.raw,
      count: safeNumber(r.count),
    })),
    source_collection_count: sourceCount,
  };
}
