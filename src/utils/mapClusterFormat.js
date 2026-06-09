/** 클러스터·밀도 오버레이 공통 숫자 표기 */
export function formatClusterMarkerCount(size) {
  const n = Math.max(0, Math.floor(Number(size) || 0));
  if (n < 1000) return String(n);
  if (n < 10000) {
    const k = n / 1000;
    const t = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${String(t).replace(/\.0$/, "")}k`;
  }
  return `${Math.round(n / 1000)}k`;
}

/** @param {number} count */
export function densityClusterBubblePx(count) {
  const n = Math.max(1, Number(count) || 1);
  if (n >= 500) return 64;
  if (n >= 200) return 58;
  if (n >= 80) return 52;
  if (n >= 30) return 46;
  return 40;
}

/**
 * @param {number} count
 * @returns {import('react').CSSProperties}
 */
export function densityClusterBubbleStyle(count) {
  const px = densityClusterBubblePx(count);
  const fs = px >= 58 ? 15 : px >= 46 ? 14 : 13;
  return {
    width: `${px}px`,
    height: `${px}px`,
    borderRadius: `${Math.ceil(px / 2)}px`,
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    color: "#111",
    textAlign: "center",
    lineHeight: `${px}px`,
    fontSize: `${fs}px`,
    fontWeight: 700,
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif',
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    userSelect: "none",
    pointerEvents: "none",
  };
}
