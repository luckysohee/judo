import { createSupabaseServiceClient } from "./supabaseServiceRole.js";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const MAX_QUERY_LEN = 80;

/**
 * @param {string} raw
 * @returns {string}
 */
export function sanitizePublicCourseSearchQuery(raw) {
  let q = String(raw ?? "")
    .trim()
    .slice(0, MAX_QUERY_LEN);
  if (q.startsWith("@")) q = q.replace(/^@+/, "").trim();
  if (!q) return "";
  return q.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} sb
 * @param {{ query: string, limit: number, offset: number }} opts
 */
async function searchViaRpc(sb, { query, limit, offset }) {
  const { data, error } = await sb.rpc("search_public_curator_courses", {
    p_query: query,
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
 * RPC 미적용 DB용 폴백 — 제목·지역·설명만
 * @param {import("@supabase/supabase-js").SupabaseClient} sb
 * @param {{ query: string, limit: number, offset: number }} opts
 */
async function searchViaTableFallback(sb, { query, limit, offset }) {
  const escaped = query.replace(/[%_\\,]/g, " ").trim();
  const pattern = `%${escaped}%`;
  const end = offset + limit;

  let curatorIds = [];
  try {
    const { data: curs } = await sb
      .from("curators")
      .select("user_id")
      .or(
        `name.ilike.${pattern},display_name.ilike.${pattern},username.ilike.${pattern},slug.ilike.${pattern}`
      )
      .limit(40);
    curatorIds = (curs || [])
      .map((r) => String(r?.user_id || "").trim())
      .filter(Boolean);
  } catch {
    curatorIds = [];
  }

  let orFilter = `title.ilike.${pattern},area.ilike.${pattern},description.ilike.${pattern}`;
  if (curatorIds.length > 0) {
    orFilter += `,curator_id.in.(${curatorIds.join(",")})`;
  }

  const { data, error } = await sb
    .from("curator_courses")
    .select(
      "id, curator_id, title, description, cover_image_url, area, theme_tags, status, is_public, created_at, updated_at, curator_course_places(count)"
    )
    .eq("status", "published")
    .eq("is_public", true)
    .is("imported_from_course_id", null)
    .or(orFilter)
    .order("updated_at", { ascending: false })
    .range(offset, end);

  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const courses = page.map((row) => {
    const nested = row.curator_course_places;
    const { curator_course_places: _omit, ...rest } = row;
    let place_count = 0;
    if (Array.isArray(nested) && nested[0]?.count != null) {
      place_count = Number(nested[0].count) || 0;
    }
    return { ...rest, place_count, preview_steps: [] };
  });
  return {
    courses,
    hasMore,
  };
}

/**
 * GET /api/courses/search?q=&limit=&offset=
 * Supabase RPC `search_public_curator_courses` — service role (RPC 미적용 시 테이블 폴백).
 */
export async function handleSearchPublicCourses(req, res) {
  const qRaw = typeof req.query?.q === "string" ? req.query.q : "";
  const query = sanitizePublicCourseSearchQuery(qRaw);
  if (!query) {
    return res.status(400).json({
      ok: false,
      message: "검색어 q 가 필요합니다.",
    });
  }

  const rawLim = Number(req.query?.limit);
  const rawOff = Number(req.query?.offset);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLim) ? Math.floor(rawLim) : DEFAULT_LIMIT)
  );
  const offset = Math.max(
    0,
    Number.isFinite(rawOff) ? Math.floor(rawOff) : 0
  );

  const { client: sb, error: envErr } = createSupabaseServiceClient();
  if (envErr || !sb) {
    return res.status(503).json({
      ok: false,
      message:
        "Supabase service role 키가 server 환경변수에 없어요 (SUPABASE_SERVICE_ROLE_KEY)",
    });
  }

  try {
    let result;
    try {
      result = await searchViaRpc(sb, { query, limit, offset });
    } catch (rpcErr) {
      const msg = String(rpcErr?.message || rpcErr || "");
      if (/search_public_curator_courses|42883|does not exist/i.test(msg)) {
        console.warn(
          "[searchPublicCourses] RPC missing — table fallback:",
          msg
        );
        result = await searchViaTableFallback(sb, { query, limit, offset });
      } else {
        throw rpcErr;
      }
    }

    const courses = (result.courses || []).map((row) => ({
      ...row,
      preview_steps: Array.isArray(row.preview_steps) ? row.preview_steps : [],
      place_count: Math.max(0, Math.floor(Number(row.place_count) || 0)),
    }));

    return res.json({
      ok: true,
      query,
      courses,
      has_more: Boolean(result.hasMore),
    });
  } catch (e) {
    console.error("/api/courses/search", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
}
