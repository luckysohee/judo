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
 * @returns {Promise<boolean>}
 */
export async function isListScrappedByMe(listId) {
  const id = parseUuid(listId);
  const user = await getSupabaseUserSafe();
  if (!id || !user?.id) return false;

  const { data, error } = await supabase
    .from("curator_list_scraps")
    .select("id")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[isListScrappedByMe]", error);
    }
    return false;
  }
  return Boolean(data?.id);
}

/**
 * 공개 맛집첩 스크랩 토글 (원본 복제 없음)
 * @returns {Promise<{ scrapped: boolean }>}
 */
export async function toggleCuratorListScrap(listId) {
  const id = parseUuid(listId);
  const user = await getSupabaseUserSafe();
  if (!id) throw new Error("맛집첩 ID가 올바르지 않습니다.");
  if (!user?.id) throw new Error("로그인이 필요합니다.");

  const { data: existing, error: selErr } = await supabase
    .from("curator_list_scraps")
    .select("id")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    if (isSupabaseSchemaMissingError(selErr)) {
      throw new Error(
        "스크랩 DB가 아직 없어요. supabase/migrations/RUN_curator_list_engagement.sql 을 적용해 주세요."
      );
    }
    throw selErr;
  }

  if (existing?.id) {
    const { error: delErr } = await supabase
      .from("curator_list_scraps")
      .delete()
      .eq("id", existing.id);
    if (delErr) throw delErr;
    return { scrapped: false };
  }

  const { error: insErr } = await supabase
    .from("curator_list_scraps")
    .insert({ list_id: id, user_id: user.id });
  if (insErr) throw insErr;
  return { scrapped: true };
}
