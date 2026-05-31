/**
 * OAuth 완료 후 돌아올 URL — 폰(LAN IP)·PC(localhost) 각각 현재 origin 기준.
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs 에
 * `http://<IP>:5173/**` 와 `http://localhost:5173/**` 가 있어야 함.
 */
export function getAuthOAuthRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  const { origin, pathname, search } = window.location;
  const path = pathname && pathname !== "" ? pathname : "/";
  return `${origin}${path}${search || ""}`;
}
