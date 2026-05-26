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
export async function isCourseLikedByMe(courseId) {
  const id = parseUuid(courseId);
  const user = await getSupabaseUserSafe();
  if (!id || !user?.id) return false;

  const { data, error } = await supabase
    .from("curator_course_likes")
    .select("id")
    .eq("course_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[isCourseLikedByMe]", error);
    }
    return false;
  }
  return Boolean(data?.id);
}

/**
 * @returns {Promise<{ liked: boolean, likeCount: number }>}
 */
export async function toggleCuratorCourseLike(courseId) {
  const id = parseUuid(courseId);
  const user = await getSupabaseUserSafe();
  if (!id) throw new Error("코스 ID가 올바르지 않습니다.");
  if (!user?.id) throw new Error("로그인이 필요합니다.");

  const { data: existing, error: selErr } = await supabase
    .from("curator_course_likes")
    .select("id")
    .eq("course_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    if (isSupabaseSchemaMissingError(selErr)) {
      throw new Error(
        "좋아요 기능 DB가 아직 적용되지 않았어요. supabase/migrations/20260516150000_curator_course_likes.sql 을 실행해 주세요."
      );
    }
    throw selErr;
  }

  if (existing?.id) {
    const { error: delErr } = await supabase
      .from("curator_course_likes")
      .delete()
      .eq("id", existing.id);
    if (delErr) throw delErr;
  } else {
    const { error: insErr } = await supabase
      .from("curator_course_likes")
      .insert({ course_id: id, user_id: user.id });
    if (insErr) throw insErr;
  }

  const { data: stats, error: statsErr } = await supabase.rpc(
    "get_course_like_stats",
    { p_course_id: id }
  );
  if (statsErr) throw statsErr;

  return {
    liked: !existing?.id,
    likeCount: Math.max(0, Math.floor(Number(stats?.like_count) || 0)),
  };
}
