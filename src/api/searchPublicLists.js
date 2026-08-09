import { supabase } from "./client";
import { isSupabaseSchemaMissingError } from "../utils/supabaseSchemaErrors";
import { filterListsForDiscoverySearch } from "../utils/listDiscoverySearch";
import { fetchPublicCuratorLists } from "./curatorLists";

function normalizeListSearchRow(row) {
  if (!row || typeof row !== "object") return null;
  const nested = row.curator_list_places;
  let place_count = Number(row.place_count) || 0;
  const placeNames = [];
  if (Array.isArray(nested)) {
    if (nested.length > 0 && nested[0]?.count != null && !nested[0]?.places) {
      place_count = Number(nested[0].count) || 0;
    } else {
      place_count = nested.length;
      for (const clp of nested) {
        const pl =
          clp?.places && typeof clp.places === "object" ? clp.places : null;
        const n = String(pl?.name || pl?.place_name || "").trim();
        if (n) placeNames.push(n);
        const addr = String(pl?.address || "").trim();
        if (addr) placeNames.push(addr);
      }
    }
  }
  const { curator_list_places: _omit, ...rest } = row;
  return {
    ...rest,
    place_count,
    _placeNames: placeNames,
  };
}

/**
 * RPC 실패 시 — 공개 맛집첩 + 장소명까지 불러 로컬 느슨 필터
 */
async function searchPublicCuratorListsClient(rawQuery, opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(60, Math.floor(opts.limit))
      : 48;

  const { data, error } = await supabase
    .from("curator_lists")
    .select(
      `
      id,
      curator_id,
      title,
      description,
      cover_image_url,
      area,
      theme_tags,
      status,
      is_public,
      created_at,
      updated_at,
      curator_list_places (
        places ( name, address )
      )
    `
    )
    .eq("status", "published")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    /** places 조인 실패 시 메타만으로라도 검색 */
    const fallback = await fetchPublicCuratorLists({ limit });
    return {
      lists: filterListsForDiscoverySearch(fallback, rawQuery),
      hasMore: false,
      source: "client-meta",
    };
  }

  const rows = (Array.isArray(data) ? data : [])
    .map(normalizeListSearchRow)
    .filter(Boolean);

  return {
    lists: filterListsForDiscoverySearch(rows, rawQuery),
    hasMore: false,
    source: "client",
  };
}

/**
 * @param {string} rawQuery
 * @param {{ limit?: number, offset?: number }} [opts]
 * @returns {Promise<{ lists: object[], hasMore: boolean, source?: string }>}
 */
export async function searchPublicCuratorLists(rawQuery, opts = {}) {
  const q = String(rawQuery || "").trim();
  if (!q) {
    return { lists: [], hasMore: false, source: "empty" };
  }

  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(60, Math.floor(opts.limit))
      : 36;
  const offset =
    typeof opts.offset === "number" && opts.offset > 0
      ? Math.floor(opts.offset)
      : 0;

  const { data, error } = await supabase.rpc("search_public_curator_lists", {
    p_query: q,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    if (!isSupabaseSchemaMissingError(error)) {
      console.warn("[searchPublicCuratorLists] RPC:", error);
    }
    return searchPublicCuratorListsClient(q, { limit: Math.max(limit, 48) });
  }

  const payload = data && typeof data === "object" ? data : {};
  const lists = Array.isArray(payload.lists) ? payload.lists : [];
  return {
    lists: lists.map((row) => ({
      ...row,
      place_count: Number(row?.place_count) || 0,
    })),
    hasMore: Boolean(payload.has_more),
    source: "rpc",
  };
}
