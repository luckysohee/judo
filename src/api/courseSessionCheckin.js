import { getMyActiveCourseSession } from "./courseSessions";
import { applyCourseStampsAfterCheckIn } from "./coursePlaceStamps";

export { hasUserCompletedCourseInLogs as hasUserCompletedCourse } from "./completedCourseLogs";
export { checkinIdMatchesStepPlace } from "../utils/checkinIdMatchesStepPlace";
export {
  fetchMyCoursePlaceStamps,
  fetchCourseStampSteps,
  resolveCourseGuideStepIndex,
} from "./coursePlaceStamps";

/**
 * 한잔함 성공 직후: 장소별 도장 + 따라가기 가이드 + 전부 모이면 완주.
 *
 * @param {string} checkinPlaceId
 * @param {{ courseIdHint?: string }} [opts]
 */
export async function handleCourseProgressAfterCheckIn(checkinPlaceId, opts = {}) {
  const checkinPid = String(checkinPlaceId ?? "").trim();
  if (!checkinPid) {
    return { ok: false, reason: "no_place_id" };
  }

  const session = await getMyActiveCourseSession();
  const hint = String(opts.courseIdHint ?? "").trim();
  if (!session?.id && !hint) {
    return { ok: false, reason: "no_course_context" };
  }

  return applyCourseStampsAfterCheckIn(checkinPid, { courseIdHint: hint });
}
