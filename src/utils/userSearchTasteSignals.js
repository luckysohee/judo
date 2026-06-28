/**
 * 사용자 본인 검색 이력(search_logs) → 행동 기반 취향 신호 (LLM 없음).
 *
 * search_logs 는 행마다 user_id 가 있고, RLS 로 "본인 로그만 조회" 가능.
 * parsed_region / parsed_alcohol / parsed_vibe 는 단일 한국어 문자열.
 */

import { supabase } from "../lib/supabase";

const DEFAULT_DAYS = 60;
const DEFAULT_LIMIT = 500;

function bumpCount(map, raw) {
  const v = String(raw ?? "").trim();
  if (!v) return;
  map.set(v, (map.get(v) || 0) + 1);
}

function sortedEntries(map, limit) {
  const arr = [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return typeof limit === "number" ? arr.slice(0, limit) : arr;
}

/**
 * 순수 함수 — search_logs 행 배열을 빈도 신호로 집계.
 * @param {Array<{user_query?:string, parsed_region?:string, parsed_alcohol?:string, parsed_vibe?:string}>} rows
 * @returns {{regions:Array<{value:string,count:number}>, liquor:Array<{value:string,count:number}>, vibes:Array<{value:string,count:number}>, topQueries:Array<{value:string,count:number}>, totalSearches:number}}
 */
export function aggregateSearchTasteSignals(rows) {
  const regionMap = new Map();
  const liquorMap = new Map();
  const vibeMap = new Map();
  const queryMap = new Map();
  let totalSearches = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    totalSearches += 1;
    bumpCount(regionMap, row?.parsed_region);
    bumpCount(liquorMap, row?.parsed_alcohol);
    bumpCount(vibeMap, row?.parsed_vibe);
    bumpCount(queryMap, row?.user_query);
  }

  return {
    regions: sortedEntries(regionMap, 8),
    liquor: sortedEntries(liquorMap, 8),
    vibes: sortedEntries(vibeMap, 8),
    topQueries: sortedEntries(queryMap, 12),
    totalSearches,
  };
}

/**
 * 검색 신호가 추천에 쓸 만큼 충분한지.
 * @param {ReturnType<typeof aggregateSearchTasteSignals>|null|undefined} signals
 * @param {{minSearches?:number}} [opts]
 */
export function searchSignalsHaveEnough(signals, opts = {}) {
  if (!signals) return false;
  const minSearches = Number(opts.minSearches) || 4;
  if ((signals.totalSearches || 0) < minSearches) return false;
  return (
    (signals.regions && signals.regions.length > 0) ||
    (signals.liquor && signals.liquor.length > 0) ||
    (signals.vibes && signals.vibes.length > 0)
  );
}

/**
 * 본인 검색 이력을 가져와 신호로 집계.
 * @param {string} userId auth uid (search_logs.user_id 는 TEXT)
 * @param {{days?:number, limit?:number, client?:import("@supabase/supabase-js").SupabaseClient}} [opts]
 */
export async function fetchUserSearchTasteSignals(userId, opts = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return aggregateSearchTasteSignals([]);

  const client = opts.client || supabase;
  const days = Number(opts.days) || DEFAULT_DAYS;
  const limit = Number(opts.limit) || DEFAULT_LIMIT;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("search_logs")
    .select("user_query, parsed_region, parsed_alcohol, parsed_vibe, timestamp")
    .eq("user_id", uid)
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    if (import.meta.env?.DEV) {
      console.warn("[userSearchTasteSignals] fetch:", error.message || error);
    }
    return aggregateSearchTasteSignals([]);
  }

  return aggregateSearchTasteSignals(data);
}
