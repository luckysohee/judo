/**
 * 로컬 개발 — 매번 다른 계정으로 로그인하기
 * .env: VITE_AUTH_DEV_FRESH_LOGIN=true (DEV 빌드에서만 동작)
 */
export function isAuthDevFreshLoginEnabled() {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_AUTH_DEV_FRESH_LOGIN === "true"
  );
}

/** Supabase auth localStorage 키 제거 (이전 persist 세션) */
export function clearSupabaseAuthLocalStorage(supabaseUrl) {
  if (typeof localStorage === "undefined") return;
  const ref = projectRefFromSupabaseUrl(supabaseUrl);
  const keys = ref
    ? [`sb-${ref}-auth-token`]
    : Object.keys(localStorage).filter(
        (k) => k.startsWith("sb-") && k.includes("-auth-token")
      );
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function projectRefFromSupabaseUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const host = new URL(raw).hostname;
    return host.split(".")[0] || "";
  } catch {
    return "";
  }
}

/** persistSession:false 대체 — 탭 닫기 전까지만 유지 */
export function createAuthMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

/**
 * @param {'google'|'kakao'|string} provider
 */
export function oauthQueryParamsForDevFreshLogin(provider) {
  if (!isAuthDevFreshLoginEnabled()) return undefined;
  const p = String(provider || "").toLowerCase();
  if (p === "google") {
    return { prompt: "select_account" };
  }
  if (p === "kakao") {
    return { prompt: "login" };
  }
  return { prompt: "select_account" };
}
