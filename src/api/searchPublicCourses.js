/**
 * 홈 「지금 뜨는 코스」 검색 — 서버 `/api/courses/search` (48 fetch 풀과 분리).
 *
 * @param {string} rawQuery
 * @param {{ limit?: number, offset?: number, apiBaseUrl?: string }} [opts]
 * @returns {Promise<{ courses: object[], hasMore: boolean }>}
 */
export async function searchPublicCuratorCourses(rawQuery, opts = {}) {
  const q = String(rawQuery || "").trim();
  if (!q) {
    return { courses: [], hasMore: false };
  }

  const limit = Math.min(
    50,
    Math.max(1, Math.floor(Number(opts.limit) || 24))
  );
  const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));

  const qs = new URLSearchParams({
    q,
    limit: String(limit),
    offset: String(offset),
  });
  const path = `/api/courses/search?${qs.toString()}`;
  const base = String(
    opts.apiBaseUrl ||
      (typeof import.meta !== "undefined"
        ? import.meta.env?.VITE_AI_API_BASE_URL
        : "") ||
      ""
  ).replace(/\/$/, "");
  const url = base ? `${base}${path}` : path;

  const res = await fetch(url);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data?.ok) {
    const msg =
      (data && data.message) || res.statusText || "courses search failed";
    throw new Error(msg);
  }
  return {
    courses: Array.isArray(data.courses) ? data.courses : [],
    hasMore: Boolean(data.has_more),
  };
}
