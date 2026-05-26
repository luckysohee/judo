const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

export const COURSE_COMPOSE_ASSIST_MS = 8000;

/**
 * @param {{
 *   query: string,
 *   parsed?: Record<string, unknown>,
 *   candidates: unknown[],
 *   maxPick?: number,
 * }} payload
 * @returns {Promise<{ ok: true, courseKeys: string[], summary: string, reasons: { courseKey: string, reason: string }[] } | null>}
 */
export async function fetchCourseComposeAssist(payload) {
  const url = AI_API_BASE
    ? `${AI_API_BASE}/api/course-compose-assist`
    : "/api/course-compose-assist";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (
      !data?.ok ||
      !Array.isArray(data.courseKeys) ||
      !data.courseKeys.length
    ) {
      return null;
    }
    return data;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[course-compose-assist]", e?.message || e);
    }
    return null;
  }
}

/**
 * @param {Parameters<typeof fetchCourseComposeAssist>[0]} payload
 * @param {number} [ms]
 */
export function raceCourseComposeAssist(
  payload,
  ms = COURSE_COMPOSE_ASSIST_MS
) {
  return Promise.race([
    fetchCourseComposeAssist(payload),
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
