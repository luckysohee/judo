import { createClient } from "@supabase/supabase-js";

import { createSupabaseServiceClient } from "./supabaseServiceRole.js";

let supabaseAuthClient = null;

/** JWT → user (매 API getUser 생략) */
const JWT_USER_CACHE_TTL_MS = 5 * 60 * 1000;
/** uid → allowlist (매 API DB 2회 생략) */
const ALLOWLIST_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_JWT_CACHE_ENTRIES = 200;
const MAX_ALLOWLIST_CACHE_ENTRIES = 300;

/** @type {Map<string, { user: object, expiresAt: number }>} */
const jwtUserCache = new Map();
/** @type {Map<string, { allowed: boolean, expiresAt: number }>} */
const allowlistCache = new Map();

function getSupabaseAuthClient() {
  if (supabaseAuthClient) return supabaseAuthClient;
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !anonKey) return null;
  supabaseAuthClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAuthClient;
}

function pruneCache(map, maxEntries) {
  if (map.size <= maxEntries) return;
  const now = Date.now();
  for (const [key, entry] of map) {
    if (entry.expiresAt <= now) map.delete(key);
  }
  while (map.size > maxEntries) {
    const first = map.keys().next().value;
    if (first == null) break;
    map.delete(first);
  }
}

export function isAlphaAllowlistEnabledServer() {
  return String(process.env.ALPHA_ALLOWLIST_ENABLED || "").trim() === "true";
}

async function resolveAuthUser(req) {
  if (req.authUser) return req.authUser;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const cached = jwtUserCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const client = getSupabaseAuthClient();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    jwtUserCache.set(token, {
      user: data.user,
      expiresAt: Date.now() + JWT_USER_CACHE_TTL_MS,
    });
    pruneCache(jwtUserCache, MAX_JWT_CACHE_ENTRIES);
    return data.user;
  } catch {
    return null;
  }
}

async function isUserAlphaAllowed(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  const uid = user?.id;
  if (!email || !uid) return false;

  const cached = allowlistCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed;
  }

  const { client } = createSupabaseServiceClient();
  if (!client) {
    console.warn("[alpha] service role missing — deny API access");
    return false;
  }

  const [profileRes, allowlistRes] = await Promise.all([
    client.from("profiles").select("role").eq("id", uid).maybeSingle(),
    client.from("alpha_access_allowlist").select("email").eq("email", email).maybeSingle(),
  ]);

  const allowed =
    profileRes.data?.role === "admin" || Boolean(allowlistRes.data);

  allowlistCache.set(uid, {
    allowed,
    expiresAt: Date.now() + ALLOWLIST_CACHE_TTL_MS,
  });
  pruneCache(allowlistCache, MAX_ALLOWLIST_CACHE_ENTRIES);

  return allowed;
}

/**
 * 알파 모드일 때 `/api/*` (health 제외)는 JWT + allowlist 필수.
 */
export async function requireAlphaAllowlistForApi(req, res, next) {
  if (!isAlphaAllowlistEnabledServer()) return next();
  if (req.path === "/api/health") return next();
  if (!req.path.startsWith("/api/")) return next();

  const user = await resolveAuthUser(req);
  if (!user) {
    return res.status(403).json({
      ok: false,
      error: "alpha_access_required",
      message: "알파 비공개 — 로그인이 필요합니다",
    });
  }

  const allowed = await isUserAlphaAllowed(user);
  if (!allowed) {
    return res.status(403).json({
      ok: false,
      error: "alpha_access_denied",
      message: "초대된 계정만 이용할 수 있습니다",
    });
  }

  req.authUser = user;
  return next();
}
