import { supabase } from "./client";
import { getSupabaseUserSafe } from "../lib/supabaseAuth";
import { isSupabaseSchemaMissingError } from "../utils/supabaseSchemaErrors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RPC 미적용 시 세션 동안 재호출·404 스팸 방지 */
let listLikeStatsRpcMissing = false;

function parseUuid(id) {
  const s = String(id ?? "").trim().toLowerCase();
  if (!s || !UUID_RE.test(s)) return null;
  return s;
}

const LIKE_STATS_ZEROS = Object.freeze({
  like_count: 0,
  recent_like_count_7d: 0,
});

/**
 * @param {unknown} data
 * @returns {{ like_count: number, recent_like_count_7d: number }}
 */
function normalizeListLikeStats(data) {
  const row = data && typeof data === "object" ? data : {};
  return {
    like_count: Math.max(0, Math.floor(Number(row.like_count) || 0)),
    recent_like_count_7d: Math.max(
      0,
      Math.floor(Number(row.recent_like_count_7d) || 0)
    ),
  };
}

/**
 * @param {string} listId
 * @returns {Promise<{ like_count: number, recent_like_count_7d: number }>}
 */
export async function fetchListLikeStats(listId) {
  const id = parseUuid(listId);
  if (!id || listLikeStatsRpcMissing) return { ...LIKE_STATS_ZEROS };
  const { data, error } = await supabase.rpc("get_list_like_stats", {
    p_list_id: id,
  });
  if (error) {
    if (isSupabaseSchemaMissingError(error)) {
      listLikeStatsRpcMissing = true;
      if (import.meta.env.DEV) {
        console.warn(
          "[fetchListLikeStats] get_list_like_stats 없음 — RUN_curator_list_engagement.sql 적용 필요"
        );
      }
      return { ...LIKE_STATS_ZEROS };
    }
    console.warn("[fetchListLikeStats]", error);
    return { ...LIKE_STATS_ZEROS };
  }
  return normalizeListLikeStats(data);
}

/**
 * @returns {Promise<number>}
 */
export async function fetchListLikeCount(listId) {
  const stats = await fetchListLikeStats(listId);
  return stats.like_count;
}

/**
 * 홈 맛집첩 목록용 — listId(lowercase) → stats Map
 * @param {string[]} listIds
 * @returns {Promise<Map<string, { like_count: number, recent_like_count_7d: number }>>}
 */
export async function getListLikeStatsBatch(listIds) {
  const out = new Map();
  if (listLikeStatsRpcMissing) return out;

  const uniq = [];
  const seen = new Set();
  for (const raw of Array.isArray(listIds) ? listIds : []) {
    const id = parseUuid(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= 60) break;
  }
  if (uniq.length === 0) return out;

  const CHUNK = 8;
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const slice = uniq.slice(i, i + CHUNK);
    const rows = await Promise.all(
      slice.map(async (id) => {
        const stats = await fetchListLikeStats(id);
        return [id, stats];
      })
    );
    for (const [id, stats] of rows) {
      out.set(id, stats);
    }
    if (listLikeStatsRpcMissing) break;
  }
  return out;
}

/**
 * @returns {Promise<boolean>}
 */
export async function isListLikedByMe(listId) {
  const id = parseUuid(listId);
  const user = await getSupabaseUserSafe();
  if (!id || !user?.id) return false;

  const { data, error } = await supabase
    .from("curator_list_likes")
    .select("id")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[isListLikedByMe]", error);
    }
    return false;
  }
  return Boolean(data?.id);
}

/**
 * @returns {Promise<{ liked: boolean, likeCount: number }>}
 */
export async function toggleCuratorListLike(listId) {
  const id = parseUuid(listId);
  const user = await getSupabaseUserSafe();
  if (!id) throw new Error("맛집첩 ID가 올바르지 않습니다.");
  if (!user?.id) throw new Error("로그인이 필요합니다.");

  const { data: existing, error: selErr } = await supabase
    .from("curator_list_likes")
    .select("id")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    if (isSupabaseSchemaMissingError(selErr)) {
      throw new Error(
        "좋아요 DB가 아직 없어요. supabase/migrations/RUN_curator_list_engagement.sql 을 적용해 주세요."
      );
    }
    throw selErr;
  }

  if (existing?.id) {
    const { error: delErr } = await supabase
      .from("curator_list_likes")
      .delete()
      .eq("id", existing.id);
    if (delErr) throw delErr;
  } else {
    const { error: insErr } = await supabase
      .from("curator_list_likes")
      .insert({ list_id: id, user_id: user.id });
    if (insErr) throw insErr;
  }

  const likeCount = await fetchListLikeCount(id);
  return {
    liked: !existing?.id,
    likeCount,
  };
}
