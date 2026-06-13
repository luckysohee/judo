/** 코스 1·2·쩜오차 확정 핀 + 2차 찾기 깜빡임 후보 — 마커 아래 상호 */
export function shouldShowCourseVenueNameLabel(place) {
  return Boolean(place?.isCoursePin);
}

/** 코스 1차 핀 — 상호 라벨 강조색 */
export function isCourseFirstStepPin(place) {
  if (!place?.isCoursePin) return false;
  if (Number(place.courseStepIndex) === 1) return true;
  return String(place.courseMapCaption || "").trim() === "1차";
}

/** 핀 위 「1차」「2차」 팻말은 숨김 — 쩜오차는 전용 🍦 마커에서만 */
export function shouldShowCourseStepRouteBadge(place) {
  if (!place?.isCoursePin) return false;
  const cap = String(place.courseMapCaption || "").trim();
  if (!cap || cap === "1차" || cap === "2차") return false;
  return /쩜오/.test(cap);
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
  const isFirst = isCourseFirstStepPin(place);
  const barFill = isFirst ? "#dc2626" : "rgba(15,23,42,0.92)";
  const barStroke = isFirst ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.88)";

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
          fill="${barFill}"
          stroke="${barStroke}"
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
