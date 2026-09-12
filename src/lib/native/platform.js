/**
 * Capacitor 네이티브 셸 여부 (웹/PWA 는 false).
 */
export function isNativePlatform() {
  try {
    const cap = typeof window !== "undefined" ? window.Capacitor : null;
    if (cap && typeof cap.isNativePlatform === "function") {
      return Boolean(cap.isNativePlatform());
    }
    if (cap?.getPlatform) {
      const p = String(cap.getPlatform() || "web");
      return p === "ios" || p === "android";
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function getNativePlatform() {
  try {
    const cap = typeof window !== "undefined" ? window.Capacitor : null;
    if (cap?.getPlatform) return String(cap.getPlatform() || "web");
  } catch {
    /* ignore */
  }
  return "web";
}
