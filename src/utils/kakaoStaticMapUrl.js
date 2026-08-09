/**
 * 카카오 장소 OG staticmap — 좌표만으로 즉시 썸네일 URL (API 호출 없음).
 * 맛집첩 핀을 번호 플레이스홀더 없이 채울 때 사용.
 */
export function buildKakaoPlaceOgStaticMapUrl(lat, lng, size = 200) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const s = Math.min(800, Math.max(80, Math.round(Number(size) || 200)));
  return `https://staticmap.kakao.com/staticmap/og?type=place&srs=wgs84&size=${s}x${s}&service=placeweb&m=${encodeURIComponent(
    `${ln},${la}`
  )}`;
}

/**
 * 장소 카드 상단 미리보기 — 브라우저에서 dapi 직접 호출은 도메인 제한으로 깨짐.
 * 백엔드 `/api/kakao/static-map` 이 좌표 기준 SVG(지도 스타일 플레이스홀더)를 내려준다.
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
