import { supabase } from "../lib/supabase";

/**
 * Railway `/api/*` 호출 시 Supabase 세션 JWT 를 Authorization 헤더에 붙인다.
 * @param {Record<string, string>} [extra]
 * @returns {Promise<Record<string, string>>}
 */
export async function getApiAuthHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* 비로그인 — auth 필수 API는 서버에서 401 */
  }
  return headers;
}
