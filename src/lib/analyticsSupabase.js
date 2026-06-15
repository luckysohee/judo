import { createClient } from "@supabase/supabase-js";

let analyticsClient = null;

/** 메인 supabase 클라이언트와 storageKey·세션 공유 안 함 */
const noopAuthStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * 검색·클릭 분석 전용 — 세션/JWT 없이 anon 키만 사용.
 * 만료 JWT가 붙어 search_logs INSERT가 401 되는 것을 방지.
 */
export function getAnalyticsSupabase() {
  if (analyticsClient) return analyticsClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  analyticsClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: noopAuthStorage,
      storageKey: "judo-analytics-auth-isolated",
    },
  });
  return analyticsClient;
}
