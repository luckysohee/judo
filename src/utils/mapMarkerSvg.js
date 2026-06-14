/** Kakao MarkerImage — 고 DPR에서 SVG 선명도 (viewBox 1x, bitmap Nx) */
export function getMapMarkerRenderScale() {
  if (typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)) {
    return Math.min(3, Math.max(2, Math.round(window.devicePixelRatio)));
  }
  return 3;
}

/** @deprecated prefer getMapMarkerRenderScale() — tests / static default */
export const MAP_MARKER_RENDER_SCALE = 3;

/** @param {number} logicalW @param {number} logicalH */
export function openMarkerSvgDoc(logicalW, logicalH) {
  const r = getMapMarkerRenderScale();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${logicalW * r}" height="${logicalH * r}" viewBox="0 0 ${logicalW} ${logicalH}">`;
}

export function closeMarkerSvgDoc() {
  return "</svg>";
}

/**
 * feDropShadow 대신 바닥 타원 — 핀 가장자리가 흐려지지 않음
 * @param {number} cx
 * @param {number} baseY — 그림자 중심 Y (핀 끝 근처)
 * @param {number} halfW — 핀 반너비
 * @param {number} [opacity]
 */
export function markerGroundShadowSvg(cx, baseY, halfW, opacity = 0.24) {
  const rx = Math.max(3, Math.round(halfW * 0.38));
  const ry = Math.max(2, Math.round(halfW * 0.1));
  return `<ellipse cx="${Math.round(cx)}" cy="${Math.round(baseY)}" rx="${rx}" ry="${ry}" fill="rgba(0,0,0,${opacity})" />`;
}
