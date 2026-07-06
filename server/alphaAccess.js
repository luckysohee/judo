import { createClient } from "@supabase/supabase-js";

import { createSupabaseServiceClient } from "./supabaseServiceRole.js";

let supabaseAuthClient = null;

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

export function isAlphaAllowlistEnabledServer() {
  return String(process.env.ALPHA_ALLOWLIST_ENABLED || "").trim() === "true";
}

async function resolveAuthUser(req) {
  if (req.authUser) return req.authUser;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const client = getSupabaseAuthClient();
  if (!client) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function isUserAlphaAllowed(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  const uid = user?.id;
  if (!email || !uid) return false;

  const { client } = createSupabaseServiceClient();
  if (!client) {
    console.warn("[alpha] service role missing — deny API access");
    return false;
  }

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();

  if (profile?.role === "admin") return true;

  const { data: row } = await client
    .from("alpha_access_allowlist")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  return Boolean(row);
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
