import { supabase } from "./client";
import { getSupabaseUserSafe } from "../lib/supabaseAuth";
import { isSupabaseSchemaMissingError } from "../utils/supabaseSchemaErrors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuid(id) {
  const s = String(id ?? "").trim().toLowerCase();
  if (!s || !UUID_RE.test(s)) return null;
  return s;
}

/**
 * @returns {Promise<number>}
 */
export async function fetchListLikeCount(listId) {
  const id = parseUuid(listId);
  if (!id) return 0;
  const { data, error } = await supabase.rpc("get_list_like_stats", {
    p_list_id: id,
  });
  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[fetchListLikeCount]", error);
    }
    return 0;
  }
  return Math.max(0, Math.floor(Number(data?.like_count) || 0));
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
