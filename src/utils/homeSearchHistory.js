/**
 * 홈 최근검색 — 1차 localStorage, 2차 Supabase(로그인) 동기화용 API.
 *
 * @typedef {'place' | 'place_kakao' | 'sentence'} HomeSearchHistoryKind
 *
 * @typedef {Object} HomeSearchHistoryEntry
 * @property {string} id — stable id (hash of normalized query + kind)
 * @property {string} query — 표시·재검색용 원문
 * @property {HomeSearchHistoryKind} kind
 * @property {string} [channel] — auto | basic | ai
 * @property {number} searchedAt — epoch ms
 * @property {Object} [meta] — kakao place id, region chip, etc.
 *
 * @typedef {'recent' | 'place' | 'sentence'} HomeSearchHistoryChip
 */

const STORAGE_VERSION = 1;
const MAX_ENTRIES = 20;

const GUEST_KEY = "judo_home_search_history_v1";
const userKey = (userId) => `judo_home_search_history_v1_${userId}`;

function safeParse(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.v !== STORAGE_VERSION || !Array.isArray(data.entries)) return null;
    return data.entries;
  } catch {
    return null;
  }
}

function normalizeQuery(q) {
  return String(q || "").replace(/\s+/g, " ").trim();
}

function inferKind(query, explicitKind) {
  if (explicitKind) return explicitKind;
  const q = normalizeQuery(query);
  if (!q) return "place";
  if (q.length >= 8 || /\s/.test(q)) return "sentence";
  return "place";
}

function entryId(query, kind) {
  const base = `${kind}:${normalizeQuery(query).toLowerCase()}`;
  let h = 0;
  for (let i = 0; i < base.length; i += 1) {
    h = (h << 5) - h + base.charCodeAt(i);
    h |= 0;
  }
  return `h${Math.abs(h).toString(36)}`;
}

function formatEntry(raw) {
  const query = normalizeQuery(raw?.query);
  if (!query) return null;
  const kind = inferKind(query, raw?.kind);
  const searchedAt = Number(raw?.searchedAt) || Date.now();
  return {
    id: raw?.id || entryId(query, kind),
    query,
    kind,
    channel: raw?.channel ? String(raw.channel) : undefined,
    searchedAt,
    meta:
      raw?.meta && typeof raw.meta === "object" ? { ...raw.meta } : undefined,
  };
}

/**
 * @param {string | null | undefined} userId
 */
export function getHomeSearchHistoryStorageKey(userId) {
  const uid = String(userId || "").trim();
  return uid ? userKey(uid) : GUEST_KEY;
}

/**
 * @param {string | null | undefined} userId
 * @returns {HomeSearchHistoryEntry[]}
 */
export function loadHomeSearchHistory(userId) {
  if (typeof localStorage === "undefined") return [];
  const key = getHomeSearchHistoryStorageKey(userId);
  const entries = safeParse(localStorage.getItem(key));
  if (!entries) return [];
  return entries
    .map(formatEntry)
    .filter(Boolean)
    .sort((a, b) => b.searchedAt - a.searchedAt)
    .slice(0, MAX_ENTRIES);
}

/**
 * @param {string | null | undefined} userId
 * @param {HomeSearchHistoryEntry[]} entries
 */
export function saveHomeSearchHistory(userId, entries) {
  if (typeof localStorage === "undefined") return;
  const key = getHomeSearchHistoryStorageKey(userId);
  const list = (entries || [])
    .map(formatEntry)
    .filter(Boolean)
    .sort((a, b) => b.searchedAt - a.searchedAt)
    .slice(0, MAX_ENTRIES);
  localStorage.setItem(
    key,
    JSON.stringify({ v: STORAGE_VERSION, entries: list })
  );
}

/**
 * 검색 제출 성공 시 호출.
 *
 * @param {{
 *   userId?: string | null,
 *   query: string,
 *   kind?: HomeSearchHistoryKind,
 *   channel?: string,
 *   meta?: Object,
 * }} params
 * @returns {HomeSearchHistoryEntry[]}
 */
export function recordHomeSearchHistory({
  userId,
  query,
  kind,
  channel,
  meta,
}) {
  const formatted = formatEntry({
    query,
    kind,
    channel,
    meta,
    searchedAt: Date.now(),
  });
  if (!formatted) return loadHomeSearchHistory(userId);

  const prev = loadHomeSearchHistory(userId).filter(
    (e) => e.id !== formatted.id
  );
  const next = [formatted, ...prev].slice(0, MAX_ENTRIES);
  saveHomeSearchHistory(userId, next);
  return next;
}

/**
 * @param {string | null | undefined} userId
 * @param {string} entryId
 */
export function removeHomeSearchHistoryEntry(userId, entryId) {
  const id = String(entryId || "").trim();
  const next = loadHomeSearchHistory(userId).filter((e) => e.id !== id);
  saveHomeSearchHistory(userId, next);
  return next;
}

/** @param {string | null | undefined} userId */
export function clearHomeSearchHistory(userId) {
  saveHomeSearchHistory(userId, []);
  return [];
}

/**
 * @param {HomeSearchHistoryEntry[]} entries
 * @param {HomeSearchHistoryChip} chip
 */
export function filterHomeSearchHistoryByChip(entries, chip) {
  const list = Array.isArray(entries) ? entries : [];
  if (chip === "recent") return list;
  if (chip === "place") {
    return list.filter((e) => e.kind === "place" || e.kind === "place_kakao");
  }
  if (chip === "sentence") {
    return list.filter((e) => e.kind === "sentence");
  }
  return list;
}

/**
 * UI용 짧은 날짜 (KST MM.DD.)
 * @param {number} searchedAt
 */
export function formatHomeSearchHistoryDate(searchedAt) {
  const d = new Date(searchedAt);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const mm = parts.find((p) => p.type === "month")?.value ?? "";
  const dd = parts.find((p) => p.type === "day")?.value ?? "";
  return `${mm}.${dd}.`;
}

// ——— Phase 2: Supabase (스텁) ———

/**
 * 로그인 후 서버 히스토리를 local에 병합.
 * @param {import('@supabase/supabase-js').SupabaseClient} _supabase
 * @param {string} _userId
 * @returns {Promise<HomeSearchHistoryEntry[]>}
 */
export async function pullRemoteHomeSearchHistory(_supabase, _userId) {
  // TODO: select from user_search_history order by searched_at desc limit 20
  return loadHomeSearchHistory(_userId);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} _supabase
 * @param {string} _userId
 * @param {HomeSearchHistoryEntry} _entry
 */
export async function pushRemoteHomeSearchHistory(_supabase, _userId, _entry) {
  // TODO: upsert on (user_id, query)
}
