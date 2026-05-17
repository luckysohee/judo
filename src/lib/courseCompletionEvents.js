/** 브라우저 전역: 완주 축하 오버레이 등에서 구독 */
export const COURSE_COMPLETED_EVENT = "judo:course-completed";

/**
 * @param {{
 *   courseId: string,
 *   headline: string,
 *   summaryLine: string,
 *   shareText: string,
 *   shareUrl: string,
 * }} detail
 */
export function dispatchCourseCompletedCelebration(detail) {
  if (typeof window === "undefined" || !detail || typeof detail !== "object") {
    return;
  }
  window.dispatchEvent(new CustomEvent(COURSE_COMPLETED_EVENT, { detail }));
}
