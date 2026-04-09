/**
 * 카카오 정적 지도 — 브라우저에서 dapi 직접 호출 시 도메인 제한으로 깨지므로
 * 항상 백엔드 `/api/kakao/static-map` 프록시 URL만 반환합니다.
 */
export function buildKakaoStaticMapUrl(lat, lng, options = {}) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  const base = (
    import.meta.env.VITE_AI_API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ""
  )
    .toString()
    .replace(/\/$/, "");

  const w = Math.min(800, Math.max(50, options.w ?? 400));
  const h = Math.min(800, Math.max(50, options.h ?? 400));
  const level = Math.min(14, Math.max(1, options.level ?? 3));

  const q = new URLSearchParams({
    lat: String(la),
    lng: String(ln),
    w: String(w),
    h: String(h),
    level: String(level),
  });
  const path = `/api/kakao/static-map?${q}`;
  return base ? `${base}${path}` : path;
}
