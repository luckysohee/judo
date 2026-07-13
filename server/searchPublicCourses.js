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
 * RPC가 profiles만 볼 때도 스튜디오 별명·핸들로 보강.
 * @param {import("@supabase/supabase-js").SupabaseClient} sb
 * @param {{ query: string, limit: number }} opts
 */
async function searchCoursesByCuratorLabel(sb, { query, limit }) {
  const escaped = query.replace(/[%_]/g, "").trim();
  if (!escaped) return [];
  const pattern = `%${escaped}%`;

  const packs = await Promise.all([
    sb.from("curators").select("user_id").ilike("name", pattern).limit(25),
    sb
      .from("curators")
      .select("user_id")
      .ilike("display_name", pattern)
      .limit(25),
    sb.from("curators").select("user_id").ilike("username", pattern).limit(25),
    sb.from("curators").select("user_id").ilike("slug", pattern).limit(25),
  ]);

  const idSet = new Set();
  for (const pack of packs) {
    for (const row of pack?.data || []) {
      const uid = String(row?.user_id || "").trim();
      if (uid) idSet.add(uid);
    }
  }
  const curatorIds = [...idSet];
  if (curatorIds.length === 0) return [];

  const { data, error } = await sb
    .from("curator_courses")
    .select(
      "id, curator_id, title, description, cover_image_url, area, theme_tags, status, is_public, created_at, updated_at"
    )
    .eq("status", "published")
    .eq("is_public", true)
    .is("imported_from_course_id", null)
    .in("curator_id", curatorIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[searchPublicCourses] curator label search", error.message);
    return [];
  }
  return (Array.isArray(data) ? data : []).map((row) => ({
    ...row,
    place_count: 0,
    preview_steps: [],
  }));
}

function mergeCourseRows(primary, extra, limit) {
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
 * RPC 미적용 DB용 폴백 — 제목·지역·설명 + 큐레이터 라벨
 * @param {import("@supabase/supabase-js").SupabaseClient} sb
 * @param {{ query: string, limit: number, offset: number }} opts
 */
async function searchViaTableFallback(sb, { query, limit, offset }) {
  const escaped = query.replace(/[%_\\,]/g, " ").trim();
  const pattern = `%${escaped}%`;
  const end = offset + limit;

  const { data, error } = await sb
    .from("curator_courses")
    .select(
      "id, curator_id, title, description, cover_image_url, area, theme_tags, status, is_public, created_at, updated_at, curator_course_places(count)"
    )
    .eq("status", "published")
    .eq("is_public", true)
    .is("imported_from_course_id", null)
    .or(`title.ilike.${pattern},area.ilike.${pattern},description.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .range(offset, end);

  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  let courses = page.map((row) => {
    const nested = row.curator_course_places;
    const { curator_course_places: _omit, ...rest } = row;
    let place_count = 0;
    if (Array.isArray(nested) && nested[0]?.count != null) {
      place_count = Number(nested[0].count) || 0;
    }
    return { ...rest, place_count, preview_steps: [] };
  });

  if (offset === 0) {
    const byCurator = await searchCoursesByCuratorLabel(sb, { query, limit });
    courses = mergeCourseRows(courses, byCurator, limit);
  }

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

    const coursesRaw = (result.courses || []).map((row) => ({
      ...row,
      preview_steps: Array.isArray(row.preview_steps) ? row.preview_steps : [],
      place_count: Math.max(0, Math.floor(Number(row.place_count) || 0)),
    }));

    let courses = coursesRaw;
    let hasMore = Boolean(result.hasMore);
    if (offset === 0) {
      const byCurator = await searchCoursesByCuratorLabel(sb, {
        query,
        limit,
      });
      courses = mergeCourseRows(coursesRaw, byCurator, limit);
      if (byCurator.length >= limit) hasMore = true;
    }

    return res.json({
      ok: true,
      query,
      courses,
      has_more: hasMore,
    });
  } catch (e) {
    console.error("/api/courses/search", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
}
