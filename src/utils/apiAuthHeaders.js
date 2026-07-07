import { supabase } from "../lib/supabase";

/** 연속 지도 pan 시 getSession 반복 호출 줄임 */
const SESSION_TOKEN_CACHE_MS = 45_000;
let cachedAccessToken = "";
let cachedAccessTokenUntil = 0;

function readCachedToken() {
  if (cachedAccessToken && cachedAccessTokenUntil > Date.now()) {
    return cachedAccessToken;
  }
  return "";
}

function storeCachedToken(token) {
  if (!token) {
    cachedAccessToken = "";
    cachedAccessTokenUntil = 0;
    return;
  }
  cachedAccessToken = token;
  cachedAccessTokenUntil = Date.now() + SESSION_TOKEN_CACHE_MS;
}

/** 로그아웃·세션 갱신 시 캐시 무효화 */
export function clearApiAuthHeaderCache() {
  storeCachedToken("");
}

if (typeof supabase?.auth?.onAuthStateChange === "function") {
  supabase.auth.onAuthStateChange(() => {
    clearApiAuthHeaderCache();
  });
}

/**
 * Railway `/api/*` 호출 시 Supabase 세션 JWT 를 Authorization 헤더에 붙인다.
 * @param {Record<string, string>} [extra]
 * @returns {Promise<Record<string, string>>}
 */
export async function getApiAuthHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const cached = readCachedToken();
    if (cached) {
      headers.Authorization = `Bearer ${cached}`;
      return headers;
    }
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      storeCachedToken(token);
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* 비로그인 — auth 필수 API는 서버에서 401 */
  }
  return headers;
}
