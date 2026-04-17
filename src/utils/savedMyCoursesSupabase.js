/**
 * user_saved_courses — 로그인 사용자만 (RLS + GRANT authenticated)
 */

/** @returns {Promise<Set<string>>} pair_key 집합 */
export async function fetchMySavedCoursePairKeys(supabase, userId) {
  if (!supabase || !userId) return new Set();
  const { data, error } = await supabase
    .from("user_saved_courses")
    .select("pair_key")
    .eq("user_id", userId);
  if (error) {
    console.warn("user_saved_courses pair_key list:", error.message);
    return new Set();
  }
  return new Set(
    (data || []).map((r) => String(r.pair_key || "")).filter(Boolean)
  );
}

/**
 * @param {object} supabase Supabase client
 * @param {string} userId auth user id
 * @param {object} snapshot { pairKey, title?, steps, sourceCourseKey? }
 * @returns {Promise<{ ok: true } | { ok: false, reason: "exists" | "invalid" | "auth" | "error", message?: string }>}
 */
export async function insertSavedMyCourse(supabase, userId, snapshot) {
  if (!supabase || !userId) {
    return { ok: false, reason: "auth" };
  }
  if (!snapshot?.steps?.length) {
    return { ok: false, reason: "invalid" };
  }
  const pairKey = String(snapshot.pairKey || "").trim();
  if (!pairKey) {
    return { ok: false, reason: "invalid" };
  }

  const row = {
    user_id: userId,
    pair_key: pairKey,
    title: String(snapshot.title || "나만의 코스").slice(0, 200),
    steps: snapshot.steps,
    source_course_key: snapshot.sourceCourseKey
      ? String(snapshot.sourceCourseKey).slice(0, 240)
      : null,
  };

  const { error } = await supabase.from("user_saved_courses").insert(row);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, reason: "exists" };
    }
    console.warn("user_saved_courses insert:", error);
    return {
      ok: false,
      reason: "error",
      message: error.message || String(error),
    };
  }

  return { ok: true };
}
