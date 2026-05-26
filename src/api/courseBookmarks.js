import { supabase } from "./client";
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
export async function isCuratorCourseBookmarkedByMe(courseId) {
  const id = parseUuid(courseId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!id || !user?.id) return false;

  const { data, error } = await supabase
    .from("curator_course_bookmarks")
    .select("id")
    .eq("course_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[isCuratorCourseBookmarkedByMe]", error);
    }
    return false;
  }
  return Boolean(data?.id);
}

/**
 * 공개 코스 즐겨찾기 토글 (원본 복제 없음)
 * @returns {Promise<{ saved: boolean }>}
 */
export async function toggleCuratorCourseBookmark(courseId) {
  const id = parseUuid(courseId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!id) throw new Error("코스 ID가 올바르지 않습니다.");
  if (!user?.id) throw new Error("로그인이 필요합니다.");

  const { data: existing, error: selErr } = await supabase
    .from("curator_course_bookmarks")
    .select("id")
    .eq("course_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    if (isSupabaseSchemaMissingError(selErr)) {
      throw new Error(
        "저장 기능 DB가 아직 적용되지 않았어요. supabase/migrations/20260519120000_curator_course_bookmarks.sql 을 실행해 주세요."
      );
    }
    throw selErr;
  }

  if (existing?.id) {
    const { error: delErr } = await supabase
      .from("curator_course_bookmarks")
      .delete()
      .eq("id", existing.id);
    if (delErr) throw delErr;
    return { saved: false };
  }

  const { error: insErr } = await supabase
    .from("curator_course_bookmarks")
    .insert({ course_id: id, user_id: user.id });
  if (insErr) throw insErr;
  return { saved: true };
}
