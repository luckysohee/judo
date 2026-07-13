/**
 * 홈 「지금 뜨는 코스」 검색 — 서버 `/api/courses/search` (48 fetch 풀과 분리).
 * 알파 모드에서는 JWT 필요 → Authorization 헤더 포함.
 * API 실패 시 Supabase RPC(anon)로 폴백.
 */

import { supabase } from "../lib/supabase";
import { getApiAuthHeaders } from "../utils/apiAuthHeaders.js";
import { getAiApiBaseUrl } from "../utils/apiBaseUrl.js";

/**
 * @param {string} rawQuery
 * @param {{ limit?: number, offset?: number }} opts
 */
async function searchViaSupabaseRpc(rawQuery, opts = {}) {
  const q = String(rawQuery || "").trim();
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
    opts.apiBaseUrl != null && opts.apiBaseUrl !== ""
      ? opts.apiBaseUrl
      : getAiApiBaseUrl()
  ).replace(/\/$/, "");
  const url = base ? `${base}${path}` : path;

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
      return {
        courses: Array.isArray(data.courses) ? data.courses : [],
        hasMore: Boolean(data.has_more),
      };
    }
    apiError = new Error(
      (data && (data.message || data.error)) ||
        res.statusText ||
        `courses search failed (${res.status})`
    );
  } catch (e) {
    apiError = e instanceof Error ? e : new Error(String(e));
  }

  // 알파 JWT·Railway 장애 시 — 클라에서 RPC 직접 (anon GRANT 있음)
  try {
    return await searchViaSupabaseRpc(q, { limit, offset });
  } catch (rpcErr) {
    if (import.meta.env.DEV) {
      console.warn(
        "[searchPublicCuratorCourses] API failed, RPC fallback failed",
        apiError?.message || apiError,
        rpcErr
      );
    }
    throw apiError || rpcErr;
  }
}
