const LEGACY_MUMBAI_HOST = "juordxxsjecjmgmbnzox.supabase.co";

/**
 * Mumbai → Seoul 마이그레이션 후 DB에 남은 스토리지 URL 호스트를 현재 프로젝트로 맞춤.
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function rewriteLegacySupabaseStorageUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  const currentHost = String(import.meta.env.VITE_SUPABASE_URL || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!currentHost || !u.includes(LEGACY_MUMBAI_HOST)) return u;
  return u.replace(LEGACY_MUMBAI_HOST, currentHost);
}
