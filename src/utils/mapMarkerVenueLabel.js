/** 코스 1·2·쩜오차 확정 핀 — 펄스 후보(`courseMarkerPulse`) 제외, 마커 아래 상호 */
export function shouldShowCourseVenueNameLabel(place) {
  return Boolean(place?.isCoursePin) && !place?.courseMarkerPulse;
}

function escapeSvgText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {number} centerX
 * @param {number} topY — 라벨 박스 top
 * @param {object} place
 * @param {{ maxLen?: number }} [opts]
 * @returns {{ svg: string, height: number, width: number }}
 */
export function buildCourseVenueNameLabelSvg(centerX, topY, place, opts = {}) {
  if (!shouldShowCourseVenueNameLabel(place)) {
    return { svg: "", height: 0, width: 0 };
  }
  const maxLen = opts.maxLen ?? 14;
  const name = String(place?.name || place?.place_name || "").trim();
  if (!name) return { svg: "", height: 0, width: 0 };

  const label = name.slice(0, maxLen);
  const barW = Math.min(Math.max(label.length * 7 + 10, 34), 118);
  const barH = 14;
  const x = centerX - barW / 2;

  return {
    width: barW,
    height: barH + 3,
    svg: `
      <g>
        <rect
          x="${x}"
          y="${topY}"
          width="${barW}"
          height="${barH}"
          rx="3"
          fill="rgba(15,23,42,0.92)"
          stroke="rgba(255,255,255,0.88)"
          stroke-width="0.9"
        />
        <text
          x="${centerX}"
          y="${topY + barH / 2 + 0.5}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="8.5"
          font-weight="800"
          fill="#ffffff"
          font-family="system-ui, Apple SD Gothic Neo, sans-serif"
        >${escapeSvgText(label)}</text>
      </g>`,
  };
}
