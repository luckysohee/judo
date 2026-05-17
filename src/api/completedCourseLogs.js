import { supabase } from "./client";

function throwIfSupabaseError(error, koLabel) {
  if (!error) return;
  console.error(koLabel, error);
  throw error;
}

/** @param {string|Date|null|undefined} started @param {string|Date|null|undefined} ended */
export function durationSecondsBetween(started, ended) {
  if (!started || !ended) return null;
  try {
    const a = new Date(started).getTime();
    const b = new Date(ended).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const d = Math.floor((b - a) / 1000);
    return d >= 0 ? d : 0;
  } catch {
    return null;
  }
}

/**
 * 완주 소요 시간 한 줄 (과장 없이).
 * @param {number|null|undefined} seconds
 * @returns {string|null}
 */
export function formatCompletionDurationLabel(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return null;
  const s = Math.max(0, Math.floor(Number(seconds)));
  if (s < 45) return "짧게";
  if (s < 3600) {
    const m = Math.max(1, Math.round(s / 60));
    return `약 ${m}분`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (m <= 0) return `약 ${h}시간`;
  return `약 ${h}시간 ${m}분`;
}

async function resolveCuratorDisplayName(curatorId) {
  const cid = String(curatorId ?? "").trim();
  if (!cid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", cid)
    .maybeSingle();
  if (error || !data) return null;
  const dn = String(data.display_name || "").trim();
  if (dn) return dn;
  const un = String(data.username || "").trim();
  if (un) return un.startsWith("@") ? un : `@${un}`;
  return null;
}

/**
 * 완주 1건 기록 (중복 session_id 는 무시).
 * @param {object} payload
 * @returns {Promise<boolean>} 삽입 성공 여부
 */
export async function insertCompletedCourseLog(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    console.warn("[completed_course_logs] not signed in");
    return false;
  }

  let curatorName = String(p.curatorDisplayName || "").trim() || null;
  if (!curatorName && p.curator_id) {
    curatorName = await resolveCuratorDisplayName(p.curator_id);
  }

  const completedAt =
    p.completed_at != null ? String(p.completed_at) : new Date().toISOString();
  const startedAt = p.started_at != null ? String(p.started_at) : null;
  const dur =
    p.duration_seconds != null && Number.isFinite(Number(p.duration_seconds))
      ? Math.max(0, Math.floor(Number(p.duration_seconds)))
      : durationSecondsBetween(startedAt, completedAt);

  const row = {
    user_id: user.id,
    session_id: p.session_id != null ? String(p.session_id).trim() : null,
    course_id: p.course_id != null ? String(p.course_id).trim() : null,
    completed_at: completedAt,
    started_at: startedAt,
    place_count: Math.max(0, Math.floor(Number(p.place_count) || 0)),
    course_title: String(p.course_title || "").trim() || "코스",
    course_cover_image_url: p.course_cover_image_url
      ? String(p.course_cover_image_url).trim()
      : null,
    curator_id: p.curator_id != null ? String(p.curator_id).trim() : null,
    curator_display_name: curatorName,
    duration_seconds: dur != null ? dur : null,
  };

  const { error } = await supabase.from("completed_course_logs").insert(row);
  if (error) {
    if (String(error.code || "") === "23505") {
      return false;
    }
    console.warn("[completed_course_logs] insert", error);
    return false;
  }
  return true;
}

/**
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchMyCompletedCourseLogs(opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(80, Math.floor(opts.limit))
      : 40;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return [];

  const { data, error } = await supabase
    .from("completed_course_logs")
    .select(
      "id, session_id, course_id, completed_at, started_at, place_count, course_title, course_cover_image_url, curator_id, curator_display_name, duration_seconds"
    )
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(limit);

  throwIfSupabaseError(error, "[완주 기록 목록 조회 실패]");
  return Array.isArray(data) ? data : [];
}

/**
 * 내가 해당 코스를 완주한 가장 최근 시각 (없으면 null).
 * @param {string} courseId
 * @returns {Promise<string|null>} ISO
 */
export async function getMyLatestCompletionAtForCourse(courseId) {
  const cid = String(courseId ?? "").trim();
  if (!cid) return null;
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return null;

  const { data, error } = await supabase
    .from("completed_course_logs")
    .select("completed_at")
    .eq("user_id", user.id)
    .eq("course_id", cid)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[getMyLatestCompletionAtForCourse]", error);
    return null;
  }
  const iso = data?.completed_at;
  return iso != null ? String(iso) : null;
}

/**
 * @param {string} courseId
 * @returns {Promise<boolean>}
 */
export async function hasUserCompletedCourseInLogs(courseId) {
  const t = await getMyLatestCompletionAtForCourse(courseId);
  return Boolean(t);
}

/**
 * 완주 세션 행(completeCourseSession 응답)으로 로그 삽입 + 축하 디테일 생성.
 * @param {object|null} completedSessionRow — `normalizeActiveCourseSessionRow` 결과
 * @param {{ placeCount: number }} opts
 * @returns {Promise<ReturnType<typeof buildCourseCompletionCelebrationDetail>|null>}
 */
export async function recordCourseCompletionAfterSessionClosed(
  completedSessionRow,
  opts
) {
  const row = completedSessionRow;
  if (!row || typeof row !== "object" || !row.id) return null;
  const placeCount = Math.max(0, Math.floor(Number(opts?.placeCount) || 0));
  const course = row.course && typeof row.course === "object" ? row.course : {};
  const completedAt = row.completed_at;
  const startedAt = row.started_at;
  const dur = durationSecondsBetween(startedAt, completedAt);

  await insertCompletedCourseLog({
    session_id: row.id,
    course_id: row.course_id,
    started_at: startedAt,
    completed_at: completedAt,
    place_count: placeCount,
    course_title: course.title,
    course_cover_image_url: course.cover_image_url,
    curator_id: course.curator_id,
  });

  return buildCourseCompletionCelebrationDetail({
    courseId: row.course_id,
    courseTitle: course.title,
    area: course.area,
    placeCount,
    durationSeconds: dur,
  });
}

/**
 * 축하 UI·공유용 페이로드.
 * @param {object} p
 * @returns {{ courseId: string, headline: string, summaryLine: string, shareText: string, shareUrl: string }}
 */
export function buildCourseCompletionCelebrationDetail(p) {
  const courseId = String(p.courseId ?? "").trim();
  const title = String(p.courseTitle ?? "").trim() || "코스";
  const area = String(p.area ?? "").trim();
  const placeCount = Math.max(0, Math.floor(Number(p.placeCount) || 0));
  const durLabel = formatCompletionDurationLabel(p.durationSeconds);
  const parts = [
    placeCount > 0 ? `${placeCount}곳` : null,
    durLabel,
    area ? `${area}` : null,
  ].filter(Boolean);
  const summaryLine = parts.join(" · ");
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  const shareUrl = origin
    ? `${origin}/courses/${encodeURIComponent(courseId)}`
    : `/courses/${encodeURIComponent(courseId)}`;
  const shareText = `오늘 ${title} 루트를 완주했어요 🍻`;
  return {
    courseId,
    headline: `🎉 ${title}를 완주했어요`,
    summaryLine: summaryLine || `${placeCount}곳 완주`,
    shareText,
    shareUrl,
  };
}
