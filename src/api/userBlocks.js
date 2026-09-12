import { supabase } from "./client";

/**
 * @param {string} blockerId
 * @param {string} blockedId
 */
export async function blockUser(blockerId, blockedId) {
  const a = String(blockerId || "").trim();
  const b = String(blockedId || "").trim();
  if (!a) throw new Error("로그인이 필요해요.");
  if (!b) throw new Error("차단할 사용자를 확인할 수 없어요.");
  if (a === b) throw new Error("자기 자신은 차단할 수 없어요.");

  const { error } = await supabase.from("user_blocks").upsert(
    { blocker_id: a, blocked_id: b },
    { onConflict: "blocker_id,blocked_id" }
  );

  if (error) {
    const msg = error.message || String(error);
    if (/relation .*user_blocks.* does not exist/i.test(msg)) {
      throw new Error(
        "차단 기능 준비 중입니다. 잠시 후 다시 시도하거나 고객지원에 문의해 주세요."
      );
    }
    throw new Error(msg);
  }

  return true;
}

/**
 * @param {string} blockerId
 * @param {string} blockedId
 */
export async function unblockUser(blockerId, blockedId) {
  const a = String(blockerId || "").trim();
  const b = String(blockedId || "").trim();
  if (!a || !b) throw new Error("필수 값이 없어요.");

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", a)
    .eq("blocked_id", b);

  if (error) throw new Error(error.message || String(error));
  return true;
}

/**
 * @param {string} blockerId
 * @returns {Promise<string[]>}
 */
export async function listBlockedUserIds(blockerId) {
  const a = String(blockerId || "").trim();
  if (!a) return [];

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", a);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[user_blocks] list:", error.message || error);
    }
    return [];
  }

  return (data || [])
    .map((r) => String(r.blocked_id || "").trim())
    .filter(Boolean);
}

/**
 * @param {string} blockerId
 * @returns {Promise<Array<{ blocked_id: string, created_at: string, display_name?: string|null }>>}
 */
export async function listBlockedUsersDetailed(blockerId) {
  const a = String(blockerId || "").trim();
  if (!a) return [];

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", a)
    .order("created_at", { ascending: false });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[user_blocks] detailed:", error.message || error);
    }
    return [];
  }

  const rows = data || [];
  const ids = rows.map((r) => r.blocked_id).filter(Boolean);
  if (!ids.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", ids);

  const byId = new Map((profiles || []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const p = byId.get(r.blocked_id);
    return {
      blocked_id: r.blocked_id,
      created_at: r.created_at,
      display_name:
        p?.display_name ||
        (p?.username ? `@${p.username}` : null) ||
        "사용자",
    };
  });
}

/**
 * @param {string} blockerId
 * @param {string} otherUserId
 */
export async function isUserBlocked(blockerId, otherUserId) {
  const a = String(blockerId || "").trim();
  const b = String(otherUserId || "").trim();
  if (!a || !b) return false;

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", a)
    .eq("blocked_id", b)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.blocked_id);
}
