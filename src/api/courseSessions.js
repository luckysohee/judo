import { supabase } from "./client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id, label) {
  const s = String(id ?? "").trim();
  if (!s || !UUID_RE.test(s)) {
    throw new Error(`${label}: invalid uuid`);
  }
  return s;
}

function throwIfSupabaseError(error, koLabel) {
  if (!error) return;
  console.error(koLabel, error);
  throw error;
}

/** PostgREST embed `curator_courses` → 단일 객체로 평탄화 */
export function normalizeActiveCourseSessionRow(row) {
  if (!row || typeof row !== "object") return null;
  const { curator_courses: embedded, ...rest } = row;
  const course = Array.isArray(embedded)
    ? embedded[0] ?? null
    : embedded ?? null;
  return {
    ...rest,
    course:
      course && typeof course === "object" && course.id != null ? course : null,
  };
}

/**
 * 진행 중인 코스 세션 1건 (completed·abandoned 아님). 없으면 null.
 * @returns {Promise<object|null>}
 */
export async function getMyActiveCourseSession() {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return null;

  const { data, error } = await supabase
    .from("active_course_sessions")
    .select(
      `
      id,
      user_id,
      course_id,
      current_step_index,
      started_at,
      updated_at,
      completed_at,
      abandoned_at,
      curator_courses (
        id,
        curator_id,
        title,
        cover_image_url,
        area,
        status,
        is_public
      )
    `
    )
    .eq("user_id", user.id)
    .is("completed_at", null)
    .is("abandoned_at", null)
    .maybeSingle();

  throwIfSupabaseError(error, "[진행 코스 세션 조회 실패]");
  return normalizeActiveCourseSessionRow(data);
}

/**
 * 공개 코스 따라가기 시작.
 * @param {string} courseId
 * @param {{ replaceExisting?: boolean }} [options] — true면 기존 active 세션을 abandon 후 새로 시작
 * @returns {Promise<object>}
 */
export async function startCourseSession(courseId, options = {}) {
  const cid = assertUuid(courseId, "startCourseSession.courseId");
  const replaceExisting = Boolean(options.replaceExisting);

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  const existing = await getMyActiveCourseSession();
  if (existing) {
    const same = String(existing.course_id || "") === String(cid);
    if (same) {
      return existing;
    }
    if (!replaceExisting) {
      const err = new Error("ACTIVE_SESSION_EXISTS");
      err.code = "ACTIVE_SESSION_EXISTS";
      err.session = existing;
      throw err;
    }
    await abandonCourseSession(existing.id);
  }

  const { data: courseRow, error: cErr } = await supabase
    .from("curator_courses")
    .select("id, status, is_public")
    .eq("id", cid)
    .maybeSingle();
  throwIfSupabaseError(cErr, "[코스 확인 실패]");
  if (!courseRow) {
    throw new Error("코스를 찾을 수 없어요.");
  }
  if (
    String(courseRow.status || "") !== "published" ||
    courseRow.is_public !== true
  ) {
    throw new Error("따라가기는 공개된 코스만 시작할 수 있어요.");
  }

  const { data, error } = await supabase
    .from("active_course_sessions")
    .insert({
      user_id: user.id,
      course_id: cid,
      current_step_index: 0,
    })
    .select(
      `
      id,
      user_id,
      course_id,
      current_step_index,
      started_at,
      updated_at,
      completed_at,
      abandoned_at,
      curator_courses (
        id,
        curator_id,
        title,
        cover_image_url,
        area,
        status,
        is_public
      )
    `
    )
    .single();

  throwIfSupabaseError(error, "[코스 따라가기 시작 실패]");
  return normalizeActiveCourseSessionRow(data);
}

/**
 * @param {string} sessionId
 * @param {number} stepIndex
 * @param {{ expectCurrentStepIndex?: number }} [opts] — 지정 시 해당 단계일 때만 갱신(체크인 중복·경쟁 방지)
 * @returns {Promise<object|null>} null 이면 조건 불일치로 갱신 없음
 */
export async function updateCourseSessionStep(sessionId, stepIndex, opts = {}) {
  const sid = assertUuid(sessionId, "updateCourseSessionStep.sessionId");
  const idx =
    typeof stepIndex === "number" && Number.isFinite(stepIndex)
      ? Math.floor(stepIndex)
      : Number.NaN;
  if (!Number.isFinite(idx) || idx < 0) {
    throw new Error("updateCourseSessionStep: stepIndex must be a non-negative integer");
  }

  const expectCur =
    opts.expectCurrentStepIndex != null &&
    Number.isFinite(Number(opts.expectCurrentStepIndex))
      ? Math.floor(Number(opts.expectCurrentStepIndex))
      : null;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data: row, error: fetchErr } = await supabase
    .from("active_course_sessions")
    .select("id, completed_at, abandoned_at")
    .eq("id", sid)
    .eq("user_id", user.id)
    .maybeSingle();
  throwIfSupabaseError(fetchErr, "[세션 조회 실패]");
  if (!row) {
    throw new Error("세션을 찾을 수 없어요.");
  }
  if (row.completed_at != null || row.abandoned_at != null) {
    throw new Error("이미 종료된 세션이에요.");
  }

  let q = supabase
    .from("active_course_sessions")
    .update({ current_step_index: idx })
    .eq("id", sid)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .is("abandoned_at", null);
  if (expectCur != null) {
    q = q.eq("current_step_index", expectCur);
  }
  const { data, error } = await q
    .select(
      `
      id,
      user_id,
      course_id,
      current_step_index,
      started_at,
      updated_at,
      completed_at,
      abandoned_at,
      curator_courses (
        id,
        curator_id,
        title,
        cover_image_url,
        area,
        status,
        is_public
      )
    `
    )
    .maybeSingle();

  throwIfSupabaseError(error, "[세션 단계 업데이트 실패]");
  if (!data) {
    if (expectCur != null) return null;
    throw new Error("세션 단계를 갱신하지 못했어요.");
  }
  return normalizeActiveCourseSessionRow(data);
}

/**
 * @param {string} sessionId
 * @param {{ expectCurrentStepIndex?: number }} [opts]
 * @returns {Promise<object|null>}
 */
export async function completeCourseSession(sessionId, opts = {}) {
  const sid = assertUuid(sessionId, "completeCourseSession.sessionId");
  const expectCur =
    opts.expectCurrentStepIndex != null &&
    Number.isFinite(Number(opts.expectCurrentStepIndex))
      ? Math.floor(Number(opts.expectCurrentStepIndex))
      : null;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  let q = supabase
    .from("active_course_sessions")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", sid)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .is("abandoned_at", null);
  if (expectCur != null) {
    q = q.eq("current_step_index", expectCur);
  }
  const { data, error } = await q
    .select(
      `
      id,
      user_id,
      course_id,
      current_step_index,
      started_at,
      updated_at,
      completed_at,
      abandoned_at,
      curator_courses (
        id,
        curator_id,
        title,
        cover_image_url,
        area,
        status,
        is_public
      )
    `
    )
    .maybeSingle();

  throwIfSupabaseError(error, "[코스 완주 처리 실패]");
  if (!data) {
    if (expectCur != null) return null;
    throw new Error("완주 처리에 실패했어요.");
  }
  return normalizeActiveCourseSessionRow(data);
}

/**
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
export async function abandonCourseSession(sessionId) {
  const sid = assertUuid(sessionId, "abandonCourseSession.sessionId");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("active_course_sessions")
    .update({ abandoned_at: new Date().toISOString() })
    .eq("id", sid)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .is("abandoned_at", null)
    .select(
      `
      id,
      user_id,
      course_id,
      current_step_index,
      started_at,
      updated_at,
      completed_at,
      abandoned_at,
      curator_courses (
        id,
        curator_id,
        title,
        cover_image_url,
        area,
        status,
        is_public
      )
    `
    )
    .single();

  throwIfSupabaseError(error, "[코스 따라가기 종료 실패]");
  return normalizeActiveCourseSessionRow(data);
}
