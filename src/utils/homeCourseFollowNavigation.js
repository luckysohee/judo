/** 홈(`/`) 진입 시 코스 따라가기 부트 — `navigate("/", { state })` */
export const HOME_START_COURSE_FOLLOW_STATE = "homeStartCourseFollowId";

/**
 * @param {string} courseId
 * @returns {Record<string, string> | null}
 */
export function buildHomeCourseFollowNavigationState(courseId) {
  const id = String(courseId || "").trim();
  if (!id) return null;
  return { [HOME_START_COURSE_FOLLOW_STATE]: id };
}

/**
 * @param {unknown} locationState
 * @returns {string}
 */
export function readHomeStartCourseFollowId(locationState) {
  const st =
    locationState && typeof locationState === "object" ? locationState : {};
  return String(st[HOME_START_COURSE_FOLLOW_STATE] || "").trim();
}
