/**
 * 큐레이터 등급 지도 마커 — Bootstrap Icons `geo-alt-fill` 실루엣
 * @see https://icons.getbootstrap.com/icons/geo-alt-fill/ (MIT License)
 *
 * 카카오 MarkerImage(data:image/svg+xml)용 문자열만 생성한다.
 */

/** viewBox 0 0 16 16 */
export const BOOTSTRAP_GEO_ALT_FILL_D =
  "M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z";

/**
 * @returns {{ svg: string, width: number, height: number }}
 */
export function buildCuratorPinSvg({
  tier,
  isSelected,
  savedColor,
  isLive,
  place,
  checkinMarkerDecorationsSvg,
  shadowOpacity = 0.2,
  /** 지도 위 짧은 자막 (모바일 가시) — 최대 8자 */
  mapShortCaption = "",
}) {
  const pinW = isSelected ? 42 : 34;
  const pinH = isSelected ? 50 : 40;
  const vb = 16;
  const scale = (pinW * 0.78) / vb;
  const tx = (pinW - vb * scale) / 2;
  const ty = isSelected ? 7 : 5;

  let halo = "";
  if (tier.level === "premium") {
    halo = `<ellipse cx="${pinW / 2}" cy="${pinH * 0.26}" rx="${
      pinW * 0.24
    }" ry="${pinW * 0.2}" fill="rgba(167,139,250,0.28)" />`;
  } else if (tier.level === "hot") {
    halo = `<ellipse cx="${pinW / 2}" cy="${pinH * 0.26}" rx="${
      pinW * 0.22
    }" ry="${pinW * 0.18}" fill="rgba(251,146,60,0.26)" />`;
  }

  const liveRing = isLive
    ? `<circle cx="${pinW / 2}" cy="${pinH * 0.26}" r="${
        pinW * 0.21
      }" fill="none" stroke="rgba(225,29,72,0.9)" stroke-width="1.8" />`
    : "";

  const savedDot = savedColor
    ? `<circle cx="${pinW - 7}" cy="9" r="4.5" fill="${savedColor}" stroke="#ffffff" stroke-width="1.2" />`
    : "";

  const badgeR = tier.label && String(tier.label).length > 1 ? 7.5 : 6.5;
  const badgeFs = tier.label && String(tier.label).length > 1 ? 8 : 9;
  const overlapBadge = tier.label
    ? `
      <g>
        <circle cx="${pinW - 10}" cy="${pinH - 11}" r="${badgeR}" fill="#0f172a" stroke="rgba(255,255,255,0.9)" stroke-width="1" />
        <text
          x="${pinW - 10}"
          y="${pinH - 11}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="${badgeFs}"
          font-weight="600"
          fill="#f8fafc"
          font-family="system-ui, -apple-system, Arial, sans-serif"
        >${tier.label}</text>
      </g>`
    : "";

  const liveBadge = isLive
    ? `<text
          x="${pinW / 2}"
          y="12"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="9"
          font-weight="900"
          fill="#E11D48"
          stroke="#ffffff"
          stroke-width="2"
          paint-order="stroke"
          font-family="system-ui, Arial, sans-serif"
        >LIVE</text>`
    : "";

  const courseCaptionRaw =
    place?.isCoursePin && place?.courseMapCaption
      ? String(place.courseMapCaption).trim().slice(0, 14)
      : "";
  const courseCaptionW = courseCaptionRaw
    ? Math.min(80, Math.max(52, courseCaptionRaw.length * 6 + 18))
    : 0;
  const escapeSvgText = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const courseRouteBadge = courseCaptionRaw
    ? `<g>
        <rect x="${pinW / 2 - courseCaptionW / 2}" y="1" width="${courseCaptionW}" height="14" rx="7" fill="#5b21b6" stroke="#ffffff" stroke-width="1" />
        <text x="${pinW / 2}" y="8" dominant-baseline="central" text-anchor="middle" font-size="8" font-weight="800" fill="#ffffff" font-family="system-ui, -apple-system, Arial, sans-serif">${escapeSvgText(courseCaptionRaw)}</text>
      </g>`
    : "";

  const capRaw =
    !courseCaptionRaw && mapShortCaption
      ? String(mapShortCaption).trim().slice(0, 8)
      : "";
  const capW = capRaw
    ? Math.min(78, Math.max(40, capRaw.length * 7 + 12))
    : 0;
  const mapShortCaptionBadge = capRaw
    ? `<g>
        <rect x="${pinW / 2 - capW / 2}" y="1" width="${capW}" height="13" rx="6.5" fill="rgba(124,58,237,0.94)" stroke="rgba(255,255,255,0.9)" stroke-width="0.9" />
        <text x="${pinW / 2}" y="8.5" dominant-baseline="central" text-anchor="middle" font-size="8" font-weight="800" fill="#ffffff" font-family="system-ui, -apple-system, Apple SD Gothic Neo, sans-serif">${escapeSvgText(capRaw)}</text>
      </g>`
    : "";

  const pinBody = `
    <g transform="translate(${tx},${ty}) scale(${scale})">
      <path
        d="${BOOTSTRAP_GEO_ALT_FILL_D}"
        fill="${tier.fill}"
        stroke="rgba(255,255,255,0.94)"
        stroke-width="0.5"
        stroke-linejoin="round"
      />
    </g>`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pinW}" height="${pinH}" viewBox="0 0 ${pinW} ${pinH}">
      <defs>
        <filter id="pinShade" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="${shadowOpacity}" />
        </filter>
      </defs>
      <g filter="url(#pinShade)">
        ${halo}
        ${liveRing}
        ${pinBody}
        ${savedDot}
        ${overlapBadge}
        ${liveBadge}
        ${courseRouteBadge}
        ${mapShortCaptionBadge}
        ${checkinMarkerDecorationsSvg}
      </g>
    </svg>`;

  return { svg, width: pinW, height: pinH };
}
