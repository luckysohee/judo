import { createClient } from "@supabase/supabase-js";
import { createSupabaseFetch } from "./utils/supabaseFetch.js";

export function getServiceRoleEnv() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  return { url, key };
}

export function createSupabaseServiceClient() {
  const { url, key } = getServiceRoleEnv();
  if (!url || !key) {
    return {
      client: null,
      error: "missing_service_role",
    };
  }
  return {
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createSupabaseFetch() },
    }),
    error: null,
  };
}
