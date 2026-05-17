import { supabase } from "./client";
import {
  completeCourseSession,
  getMyActiveCourseSession,
  updateCourseSessionStep,
} from "./courseSessions";
import {
  hasUserCompletedCourseInLogs,
  insertCompletedCourseLog,
  recordCourseCompletionAfterSessionClosed,
  buildCourseCompletionCelebrationDetail,
} from "./completedCourseLogs";
import { checkinIdMatchesStepPlace } from "../utils/checkinIdMatchesStepPlace";

/**
 * @typedef {{ order_index: number, place_id: string, places: object | null }} CourseStampStepRow
 */

/**
 * @param {object[]} raw
 * @returns {CourseStampStepRow[]}
 */
export function sortCourseStampSteps(raw) {
  return [...(raw || [])].sort(
    (a, b) => Number(a.order_index) - Number(b.order_index)
  );
}

/**
 * @param {string} courseId
 * @returns {Promise<CourseStampStepRow[]>}
 */
export async function fetchCourseStampSteps(courseId) {
  const cid = String(courseId ?? "").trim();
  if (!cid) return [];

  const { data, error } = await supabase
    .from("curator_course_places")
    .select(
      `
      order_index,
      place_id,
      places (
        id,
        name,
        place_id,
        kakao_place_id
      )
    `
    )
    .eq("course_id", cid);

  if (error) {
    console.warn("[fetchCourseStampSteps]", error);
    return [];
  }
  return sortCourseStampSteps(data);
}

/**
 * @param {string} courseId
 * @returns {Promise<{ stampedOrderIndices: number[], stampedPlaceIds: Set<string>, rows: object[] }>}
 */
export async function fetchMyCoursePlaceStamps(courseId) {
  const cid = String(courseId ?? "").trim();
  if (!cid) {
    return { stampedOrderIndices: [], stampedPlaceIds: new Set(), rows: [] };
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    return { stampedOrderIndices: [], stampedPlaceIds: new Set(), rows: [] };
  }

  const { data, error } = await supabase
    .from("course_place_stamps")
    .select("order_index, place_id, stamped_at")
    .eq("user_id", user.id)
    .eq("course_id", cid)
    .order("order_index", { ascending: true });

  if (error) {
    console.warn("[fetchMyCoursePlaceStamps]", error);
    return { stampedOrderIndices: [], stampedPlaceIds: new Set(), rows: [] };
  }

  const rows = Array.isArray(data) ? data : [];
  const stampedOrderIndices = [];
  const stampedPlaceIds = new Set();
  for (const r of rows) {
    const oi = Number(r.order_index);
    if (Number.isFinite(oi) && oi >= 0) stampedOrderIndices.push(oi);
    const pid = String(r.place_id ?? "").trim();
    if (pid) stampedPlaceIds.add(pid);
  }
  return { stampedOrderIndices, stampedPlaceIds, rows };
}

/**
 * @param {number} stepCount
 * @param {Set<string>|string[]} stampedPlaceIds
 * @param {CourseStampStepRow[]} steps
 */
export function resolveCourseGuideStepIndex(stepCount, stampedPlaceIds, steps) {
  const stamped =
    stampedPlaceIds instanceof Set
      ? stampedPlaceIds
      : new Set(stampedPlaceIds || []);
  const list = Array.isArray(steps) ? steps : [];
  const n = Math.max(stepCount, list.length);
  if (n <= 0) return 0;
  for (let i = 0; i < list.length; i++) {
    const pid = String(list[i]?.place_id ?? "").trim();
    if (pid && !stamped.has(pid)) return i;
  }
  return Math.max(0, n - 1);
}

/**
 * @param {string} courseId
 * @param {string} placeId
 * @param {number} orderIndex
 * @returns {Promise<boolean>}
 */
export async function insertCoursePlaceStamp(courseId, placeId, orderIndex) {
  const cid = String(courseId ?? "").trim();
  const pid = String(placeId ?? "").trim();
  const oi = Number(orderIndex);
  if (!cid || !pid || !Number.isFinite(oi) || oi < 0) return false;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return false;

  const { error } = await supabase.from("course_place_stamps").insert({
    user_id: user.id,
    course_id: cid,
    place_id: pid,
    order_index: Math.floor(oi),
  });

  if (error) {
    if (String(error.code || "") === "23505") return false;
    console.warn("[insertCoursePlaceStamp]", error);
    return false;
  }
  return true;
}

/**
 * @param {CourseStampStepRow[]} steps
 * @param {Set<string>|string[]} stampedPlaceIds
 */
export function areAllCourseStepsStamped(steps, stampedPlaceIds) {
  const list = Array.isArray(steps) ? steps : [];
  if (list.length === 0) return false;
  const stamped =
    stampedPlaceIds instanceof Set
      ? stampedPlaceIds
      : new Set(stampedPlaceIds || []);
  return list.every((s) => {
    const pid = String(s?.place_id ?? "").trim();
    return pid && stamped.has(pid);
  });
}

/**
 * @param {number} hadStamps
 * @param {number} deletedCount
 */
export function verifyStampDeleteResult(hadStamps, deletedCount) {
  if (hadStamps > 0 && deletedCount === 0) {
    return { ok: false, reason: "delete_blocked" };
  }
  return { ok: true };
}

/**
 * @param {string} courseId
 * @returns {Promise<{ ok: boolean, reason?: string, deleted?: number }>}
 */
export async function deleteMyCoursePlaceStamps(courseId) {
  const cid = String(courseId ?? "").trim();
  if (!cid) return { ok: false, reason: "bad_args" };

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return { ok: false, reason: "not_signed_in" };

  const { rows: beforeRows } = await fetchMyCoursePlaceStamps(cid);
  const hadStamps = beforeRows.length;

  const { data, error } = await supabase
    .from("course_place_stamps")
    .delete()
    .eq("user_id", user.id)
    .eq("course_id", cid)
    .select("id");

  if (error) {
    console.warn("[deleteMyCoursePlaceStamps]", error);
    return { ok: false, reason: "delete_error" };
  }

  const deleted = Array.isArray(data) ? data.length : 0;
  const verified = verifyStampDeleteResult(hadStamps, deleted);
  if (!verified.ok) {
    console.warn(
      "[deleteMyCoursePlaceStamps] had stamps but deleted 0 — check DELETE RLS"
    );
    return verified;
  }
  return { ok: true, deleted };
}

/**
 * 완주 기록은 유지하고 도장만 초기화 (다시 모으기).
 * @param {string} courseId
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function resetCourseStampsForReplay(courseId) {
  const cid = String(courseId ?? "").trim();
  if (!cid) return { ok: false, reason: "bad_args" };

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) return { ok: false, reason: "not_signed_in" };

  const deleted = await deleteMyCoursePlaceStamps(cid);
  if (!deleted.ok) {
    return { ok: false, reason: deleted.reason || "delete_failed" };
  }

  const session = await getMyActiveCourseSession();
  if (session?.id && String(session.course_id || "") === cid) {
    await updateCourseSessionStep(session.id, 0);
  }

  return { ok: true };
}

async function fetchCourseRowForCompletion(courseId) {
  const { data, error } = await supabase
    .from("curator_courses")
    .select("id, title, cover_image_url, area, curator_id, status, is_public")
    .eq("id", courseId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function finalizeCourseCompletionFromStamps(courseId, session, steps) {
  const cid = String(courseId ?? "").trim();
  const stepCount = steps.length;
  if (!cid || stepCount <= 0) return null;

  const already = await hasUserCompletedCourseInLogs(cid);

  const { stampedPlaceIds } = await fetchMyCoursePlaceStamps(cid);
  const guideIdx = resolveCourseGuideStepIndex(
    stepCount,
    stampedPlaceIds,
    steps
  );

  if (session?.id && String(session.course_id || "") === cid) {
    await updateCourseSessionStep(session.id, guideIdx);
    let done = await completeCourseSession(session.id, {
      expectCurrentStepIndex: guideIdx,
    });
    if (!done) {
      done = await completeCourseSession(session.id);
    }
    if (done && !already) {
      try {
        const detail = await recordCourseCompletionAfterSessionClosed(done, {
          placeCount: stepCount,
        });
        if (detail) return detail;
      } catch (e) {
        console.warn("[finalizeCourseCompletionFromStamps session]", e);
      }
    }
  }

  const course = await fetchCourseRowForCompletion(cid);
  if (!course) return null;

  if (!already) {
    const { rows: stampRows } = await fetchMyCoursePlaceStamps(cid);
    const startedAt =
      stampRows.length > 0 && stampRows[0]?.stamped_at
        ? String(stampRows[0].stamped_at)
        : null;

    const inserted = await insertCompletedCourseLog({
      course_id: cid,
      started_at: startedAt,
      place_count: stepCount,
      course_title: course.title,
      course_cover_image_url: course.cover_image_url,
      curator_id: course.curator_id,
    });
    if (!inserted) return null;
  }

  return buildCourseCompletionCelebrationDetail({
    courseId: cid,
    courseTitle: course.title,
    area: course.area,
    placeCount: stepCount,
    durationSeconds: null,
  });
}

export async function applyCourseStampForCheckIn(
  courseId,
  checkinPlaceId,
  session = null
) {
  const cid = String(courseId ?? "").trim();
  const checkinPid = String(checkinPlaceId ?? "").trim();
  if (!cid || !checkinPid) {
    return { ok: false, reason: "bad_args" };
  }

  const steps = await fetchCourseStampSteps(cid);
  if (steps.length === 0) {
    return { ok: false, reason: "no_steps" };
  }

  let matchIdx = -1;
  for (let i = 0; i < steps.length; i++) {
    const row = steps[i];
    const stepUuid = String(row.place_id ?? "").trim();
    const pl =
      row.places && typeof row.places === "object" ? row.places : null;
    if (checkinIdMatchesStepPlace(checkinPid, stepUuid, pl)) {
      matchIdx = i;
      break;
    }
  }
  if (matchIdx < 0) {
    return { ok: false, reason: "place_mismatch" };
  }

  const at = steps[matchIdx];
  return applyStampAtStepIndex(cid, steps, matchIdx, at, session);
}

async function applyStampAtStepIndex(courseId, steps, matchIdx, at, session) {
  const cid = String(courseId ?? "").trim();
  const newStamp = await insertCoursePlaceStamp(
    cid,
    at.place_id,
    Number(at.order_index)
  );

  const { stampedPlaceIds } = await fetchMyCoursePlaceStamps(cid);
  const allStamped = steps.every((s) =>
    stampedPlaceIds.has(String(s.place_id ?? "").trim())
  );

  const activeSession =
    session && String(session.course_id || "") === cid ? session : null;
  if (activeSession?.id) {
    const guideIdx = resolveCourseGuideStepIndex(
      steps.length,
      stampedPlaceIds,
      steps
    );
    const cur = Number(activeSession.current_step_index);
    if (Number.isFinite(guideIdx) && guideIdx !== cur) {
      await updateCourseSessionStep(activeSession.id, guideIdx);
    }
  }

  if (allStamped) {
    const completion = await finalizeCourseCompletionFromStamps(
      cid,
      activeSession,
      steps
    );
    if (completion) {
      return {
        ok: true,
        kind: "completed",
        stampIndex: matchIdx,
        newStamp,
        completion,
      };
    }
    const atRow = steps[matchIdx];
    const pl =
      atRow?.places && typeof atRow.places === "object" ? atRow.places : null;
    const placeName = String(pl?.name || pl?.place_name || "").trim();
    const label = `${matchIdx + 1}차`;
    return {
      ok: true,
      kind: "replay_completed",
      stampIndex: matchIdx,
      newStamp,
      toastMessage: placeName
        ? `${label} 도장! 다시 완주했어요 🎉`
        : "다시 완주했어요! 🎉",
    };
  }

  const atRow = steps[matchIdx];
  const pl =
    atRow?.places && typeof atRow.places === "object" ? atRow.places : null;
  const placeName = String(pl?.name || pl?.place_name || "").trim();
  const label = `${matchIdx + 1}차`;
  const toastMessage = newStamp
    ? placeName
      ? `${label} 도장! ${placeName}`
      : `${label} 도장을 찍었어요`
    : null;

  return {
    ok: true,
    kind: "stamped",
    stampIndex: matchIdx,
    newStamp,
    label,
    placeName,
    toastMessage,
  };
}

/**
 * 홈 코스 바텀시트 — 해당 차수 도장 제거(체크 해제).
 * @param {string} courseId
 * @param {number} stepIndex
 */
export async function removeCoursePlaceStampAtIndex(courseId, stepIndex) {
  const cid = String(courseId ?? "").trim();
  const idx = Math.floor(Number(stepIndex));
  if (!cid || !Number.isFinite(idx) || idx < 0) {
    return { ok: false, reason: "bad_args" };
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    return { ok: false, reason: "not_signed_in" };
  }

  const steps = await fetchCourseStampSteps(cid);
  if (steps.length === 0) {
    return { ok: false, reason: "no_steps" };
  }
  if (idx >= steps.length) {
    return { ok: false, reason: "step_out_of_range" };
  }

  const at = steps[idx];
  const pid = String(at.place_id ?? "").trim();
  if (!pid) {
    return { ok: false, reason: "no_place" };
  }

  const { data, error } = await supabase
    .from("course_place_stamps")
    .delete()
    .eq("user_id", user.id)
    .eq("course_id", cid)
    .eq("place_id", pid)
    .select("id");

  if (error) {
    console.warn("[removeCoursePlaceStampAtIndex]", error);
    return { ok: false, reason: "delete_error" };
  }

  const deleted = Array.isArray(data) ? data.length : 0;
  if (deleted === 0) {
    return { ok: false, reason: "not_stamped" };
  }

  const session = await getMyActiveCourseSession();
  if (session?.id && String(session.course_id || "") === cid) {
    const { stampedPlaceIds } = await fetchMyCoursePlaceStamps(cid);
    const guideIdx = resolveCourseGuideStepIndex(
      steps.length,
      stampedPlaceIds,
      steps
    );
    await updateCourseSessionStep(session.id, guideIdx);
  }

  const pl =
    at.places && typeof at.places === "object" ? at.places : null;
  const placeName = String(pl?.name || pl?.place_name || "").trim();
  const label = `${idx + 1}차`;

  return {
    ok: true,
    kind: "unstamped",
    stampIndex: idx,
    label,
    placeName,
    toastMessage: placeName
      ? `${label} 도장을 취소했어요 · ${placeName}`
      : `${label} 도장을 취소했어요`,
  };
}

/** 체크인 없이 도장만 — 홈 코스 바텀시트 */
export async function stampCourseStepAtIndex(courseId, stepIndex) {
  const cid = String(courseId ?? "").trim();
  const idx = Math.floor(Number(stepIndex));
  if (!cid || !Number.isFinite(idx) || idx < 0) {
    return { ok: false, reason: "bad_args" };
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    return { ok: false, reason: "not_signed_in" };
  }

  const session = await getMyActiveCourseSession();
  const steps = await fetchCourseStampSteps(cid);
  if (steps.length === 0) {
    return { ok: false, reason: "no_steps" };
  }
  if (idx >= steps.length) {
    return { ok: false, reason: "step_out_of_range" };
  }

  const at = steps[idx];
  return applyStampAtStepIndex(cid, steps, idx, at, session);
}

export async function applyCourseStampsAfterCheckIn(checkinPlaceId, opts = {}) {
  const hint = String(opts.courseIdHint ?? "").trim();
  const session = await getMyActiveCourseSession();
  const courseIds = new Set();
  if (hint) courseIds.add(hint);
  if (session?.course_id) courseIds.add(String(session.course_id).trim());

  if (courseIds.size === 0) {
    return { ok: false, reason: "no_course_context" };
  }

  const outcomes = [];
  for (const cid of courseIds) {
    const r = await applyCourseStampForCheckIn(cid, checkinPlaceId, session);
    outcomes.push({ courseId: cid, ...r });
  }

  const completed = outcomes.find((o) => o.kind === "completed");
  if (completed) return completed;

  const stamped = outcomes.find((o) => o.ok && o.kind === "stamped");
  if (stamped) return stamped;

  return outcomes[0] || { ok: false, reason: "unknown" };
}
