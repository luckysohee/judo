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
 * 핀 바닥 그림자 — 비활성(지도가 지저분해 보여 제거)
 * @param {number} _cx
 * @param {number} _baseY
 * @param {number} _halfW
 * @param {number} [_opacity]
 */
export function markerGroundShadowSvg(_cx, _baseY, _halfW, _opacity = 0.24) {
  return "";
}
