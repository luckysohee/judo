/** 코스 1·2·쩜오차 확정 핀 + 2차 찾기 깜빡임 후보 + 맛집첩 펼침 핀 — 마커 아래 상호 */
export function shouldShowCourseVenueNameLabel(place) {
  return (
    Boolean(place?.isCoursePin) ||
    Boolean(place?.courseMarkerPulse) ||
    Boolean(place?.isListSpreadPin)
  );
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
/**
 * 핀 본체 너비보다 라벨이 넓을 때 SVG 가운데 정렬(잘림 방지).
 * @returns {{ svg: string, height: number, width: number, totalW: number }}
 */
export function buildCourseVenueNameLabelForMarker(
  pinCenterX,
  pinBottomY,
  place,
  pinWidth,
  opts = {}
) {
  if (!shouldShowCourseVenueNameLabel(place)) {
    return { svg: "", height: 0, width: 0, totalW: pinWidth };
  }
  const probe = buildCourseVenueNameLabelSvg(pinCenterX, pinBottomY, place, opts);
  const totalW = Math.max(pinWidth, probe.width);
  if (totalW <= pinWidth) {
    return { ...probe, totalW };
  }
  const centered = buildCourseVenueNameLabelSvg(totalW / 2, pinBottomY, place, opts);
  return { ...centered, totalW };
}

/** 사진 원형 마커 아래 HTML에 붙일 상호 라벨 (y=0 기준) */
export function buildCourseVenueNameLabelForPhotoOverlay(pinWidth, place, opts = {}) {
  return buildCourseVenueNameLabelForMarker(pinWidth / 2, 0, place, pinWidth, opts);
}

/** `<g>` 조각을 HTML에 넣을 때 viewBox 고정 — 폰트 크기가 1차 핀 SVG와 같게 */
export function wrapVenueLabelSvgForHtml({ svg, width, height, totalW }) {
  const w = Math.max(1, Math.round(Number(totalW ?? width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  if (!svg || !w || !h) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible;">${svg}</svg>`;
}

export function buildCourseVenueNameLabelSvg(centerX, topY, place, opts = {}) {
  if (!shouldShowCourseVenueNameLabel(place)) {
    return { svg: "", height: 0, width: 0 };
  }
  const maxLen = opts.maxLen ?? 14;
  const name = String(place?.name || place?.place_name || "").trim();
  if (!name) return { svg: "", height: 0, width: 0 };

  const label = name.slice(0, maxLen);
  const barW = Math.round(Math.min(Math.max(label.length * 7.5 + 12, 36), 124));
  const barH = 15;
  const x = Math.round(centerX - barW / 2);
  const y = Math.round(topY);
  const textY = Math.round(y + barH / 2);
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
          y="${y}"
          width="${barW}"
          height="${barH}"
          rx="3"
          fill="${barFill}"
          stroke="${barStroke}"
          stroke-width="1"
          shape-rendering="crispEdges"
        />
        <text
          x="${Math.round(centerX)}"
          y="${textY}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="10"
          font-weight="800"
          fill="#ffffff"
          text-rendering="geometricPrecision"
          font-family="system-ui, -apple-system, Apple SD Gothic Neo, sans-serif"
        >${escapeSvgText(label)}</text>
      </g>`,
  };
}
