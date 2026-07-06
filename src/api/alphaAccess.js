import { supabase } from "../lib/supabase";

/**
 * 로그인 세션 기준 allowlist 통과 여부 (admin 항상 통과).
 * @returns {Promise<boolean>}
 */
export async function checkAlphaAccessAllowed() {
  const { data, error } = await supabase.rpc("check_alpha_access_allowed");
  if (error) {
    console.warn("[alpha_access] RPC failed:", error.message || error);
    return false;
  }
  return Boolean(data);
}
