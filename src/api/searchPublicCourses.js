/**
 * 홈 「지금 뜨는 코스」 검색 — 서버 `/api/courses/search` (48 fetch 풀과 분리).
 * 알파 모드에서는 JWT 필요 → Authorization 헤더 포함.
 * API 실패 시 Supabase RPC(anon)로 폴백.
 * 큐레이터 별명/핸들은 RPC 미적용 DB에서도 클라에서 curators 조회로 보강.
 */

import { supabase } from "../lib/supabase";
import { getApiAuthHeaders } from "../utils/apiAuthHeaders.js";
import { getAiApiBaseUrl } from "../utils/apiBaseUrl.js";

const COURSE_LIST_SELECT =
  "id, curator_id, title, description, cover_image_url, area, theme_tags, status, is_public, created_at, updated_at";

/**
 * @param {string} raw
 */
function normalizeCourseSearchNeedle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .trim()
    .slice(0, 80);
}

/**
 * 스튜디오 별명·핸들로 공개 코스 찾기 (RPC에 curators 조인 없어도 동작).
 * @param {string} rawQuery
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function searchPublicCoursesByCuratorLabel(rawQuery, opts = {}) {
  const q = normalizeCourseSearchNeedle(rawQuery);
  if (!q || !supabase) return [];

  const limit = Math.min(
    50,
    Math.max(1, Math.floor(Number(opts.limit) || 24))
  );
  const pattern = `%${q.replace(/[%_]/g, "")}%`;
  if (pattern === "%%") return [];

  try {
    const [byName, byDisplay, byUser, bySlug] = await Promise.all([
      supabase
        .from("curators")
        .select("user_id")
        .ilike("name", pattern)
        .limit(25),
      supabase
        .from("curators")
        .select("user_id")
        .ilike("display_name", pattern)
        .limit(25),
      supabase
        .from("curators")
        .select("user_id")
        .ilike("username", pattern)
        .limit(25),
      supabase
        .from("curators")
        .select("user_id")
        .ilike("slug", pattern)
        .limit(25),
    ]);

    const idSet = new Set();
    for (const pack of [byName, byDisplay, byUser, bySlug]) {
      if (pack?.error) {
        if (import.meta.env.DEV) {
          console.warn(
            "[searchPublicCoursesByCuratorLabel]",
            pack.error.message
          );
        }
        continue;
      }
      for (const row of pack?.data || []) {
        const uid = String(row?.user_id || "").trim();
        if (uid) idSet.add(uid);
      }
    }
    const curatorIds = [...idSet];
    if (curatorIds.length === 0) return [];

    const { data: courses, error } = await supabase
      .from("curator_courses")
      .select(COURSE_LIST_SELECT)
      .eq("status", "published")
      .eq("is_public", true)
      .is("imported_from_course_id", null)
      .in("curator_id", curatorIds)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (import.meta.env.DEV) {
        console.warn(
          "[searchPublicCoursesByCuratorLabel] courses",
          error.message
        );
      }
      return [];
    }
    return (Array.isArray(courses) ? courses : []).map((row) => ({
      ...row,
      place_count: 0,
      preview_steps: [],
    }));
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[searchPublicCoursesByCuratorLabel]", e);
    }
    return [];
  }
}

/**
 * @param {object[]} primary
 * @param {object[]} extra
 * @param {number} limit
 */
function mergeCourseLists(primary, extra, limit) {
  const seen = new Set();
  const out = [];
  for (const row of [...(primary || []), ...(extra || [])]) {
    const id = String(row?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {string} rawQuery
 * @param {{ limit?: number, offset?: number }} opts
 */
async function searchViaSupabaseRpc(rawQuery, opts = {}) {
  const q = normalizeCourseSearchNeedle(rawQuery);
  if (!q || !supabase?.rpc) {
    return { courses: [], hasMore: false };
  }
  const limit = Math.min(
    50,
    Math.max(1, Math.floor(Number(opts.limit) || 24))
  );
  const offset = Math.max(0, Math.floor(Number(opts.offset) || 0));

  const { data, error } = await supabase.rpc("search_public_curator_courses", {
    p_query: q,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const payload = data && typeof data === "object" ? data : {};
  const courses = Array.isArray(payload.courses)
    ? payload.courses
    : Array.isArray(payload)
      ? payload
      : [];
  return {
    courses,
    hasMore: Boolean(payload.has_more),
  };
}

/**
 * @param {string} rawQuery
 * @param {{ limit?: number, offset?: number, apiBaseUrl?: string }} [opts]
 * @returns {Promise<{ courses: object[], hasMore: boolean }>}
 */
export async function searchPublicCuratorCourses(rawQuery, opts = {}) {
  const q = normalizeCourseSearchNeedle(rawQuery);
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
    opts.apiBaseUrl != null && opts.apiBaseUrl !== ""
      ? opts.apiBaseUrl
      : getAiApiBaseUrl()
  ).replace(/\/$/, "");
  const url = base ? `${base}${path}` : path;

  let primary = { courses: [], hasMore: false };
  let apiError = null;
  try {
    const headers = await getApiAuthHeaders();
    const res = await fetch(url, { headers });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.ok && data?.ok) {
      primary = {
        courses: Array.isArray(data.courses) ? data.courses : [],
        hasMore: Boolean(data.has_more),
      };
    } else {
      apiError = new Error(
        (data && (data.message || data.error)) ||
          res.statusText ||
          `courses search failed (${res.status})`
      );
    }
  } catch (e) {
    apiError = e instanceof Error ? e : new Error(String(e));
  }

  if (apiError) {
    try {
      primary = await searchViaSupabaseRpc(q, { limit, offset });
    } catch (rpcErr) {
      if (import.meta.env.DEV) {
        console.warn(
          "[searchPublicCuratorCourses] API failed, RPC fallback failed",
          apiError?.message || apiError,
          rpcErr
        );
      }
      // 큐레이터 라벨 보강만으로라도 결과 시도
      primary = { courses: [], hasMore: false };
    }
  }

  // offset>0 페이지에서는 큐레이터 보강 생략 (중복·순서 꼬임 방지)
  if (offset > 0) {
    return primary;
  }

  const byCurator = await searchPublicCoursesByCuratorLabel(q, { limit });
  const merged = mergeCourseLists(primary.courses, byCurator, limit);
  return {
    courses: merged,
    hasMore: Boolean(primary.hasMore) || byCurator.length >= limit,
  };
}
