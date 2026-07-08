import { createClient } from "@supabase/supabase-js";

import { createSupabaseServiceClient } from "../supabaseServiceRole.js";

let jwtVerifyClient = null;

/**
 * 로그인 JWT 검증용 Supabase 클라이언트.
 * anon/publishable 우선, 없으면 service role (Railway에 SUPABASE_ANON_KEY 누락 시 폴백).
 */
export function getSupabaseJwtVerifyClient() {
  if (jwtVerifyClient) return jwtVerifyClient;

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

  if (url && anonKey) {
    jwtVerifyClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return jwtVerifyClient;
  }

  const { client } = createSupabaseServiceClient();
  if (client) {
    jwtVerifyClient = client;
    if (String(process.env.ALPHA_ALLOWLIST_ENABLED || "").trim() === "true") {
      console.warn(
        "⚠️ SUPABASE_ANON_KEY 없음 — JWT 검증에 service role 사용 중 (Railway에 anon/publishable 추가 권장)"
      );
    }
  }
  return jwtVerifyClient;
}
