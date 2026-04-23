import { buildCuratorPinSvg } from "./curatorPinMarker.js";

// 폴더 색상 매핑
const FOLDER_COLORS = {
  after_party: '#FF8C42',    // orange
  date: '#FF69B4',           // pink  
  hangover: '#87CEEB',       // skyblue
  solo: '#9B59B6',           // purple
  group: '#F1C40F',          // yellow
  must_go: '#27AE60',        // green
  terrace: '#2C3E50'         // black
};

// 폴더 정보 가져오기
function getFolderInfo(folders = []) {
  if (!folders || folders.length === 0) {
    return { primary: null, secondary: null, count: 0 };
  }

  const validFolders = folders.filter(f => FOLDER_COLORS[f.key]);
  const count = validFolders.length;

  if (count === 0) {
    return { primary: null, secondary: null, count: 0 };
  }

  // 우선순위: 현재 선택된 필터 > 최근 저장 폴더 > 시스템 우선순위
  const sortedFolders = validFolders.sort((a, b) => {
    // 시스템 폴더 우선순위 (after_party=1, date=2, ...)
    const priority = { after_party: 1, date: 2, hangover: 3, solo: 4, group: 5, must_go: 6, terrace: 7 };
    return (priority[a.key] || 999) - (priority[b.key] || 999);
  });

  return {
    primary: sortedFolders[0],
    secondary: sortedFolders[1],
    count
  };
}

/** 앱에 등록된 큐레이터 추천 장소 → 마커 안내(단일/공동/프리미엄) 등급 표시 */
export function isCuratorListedPlace(place) {
  if (typeof place?.curatorCount === "number" && place.curatorCount > 0) {
    return true;
  }
  if (Array.isArray(place?.curatorPlaces) && place.curatorPlaces.length > 0) {
    return true;
  }
  if (Array.isArray(place?.curators) && place.curators.length > 0) {
    return true;
  }
  return false;
}

// 큐레이터 등급 — Bootstrap geo-alt-fill 핀 색 (단일 / 공동 / 프리미엄)
export function getMarkerTier(place) {
  let curatorCount = 1;
  if (typeof place?.curatorCount === "number" && place.curatorCount > 0) {
    curatorCount = place.curatorCount;
  } else if (Array.isArray(place?.curators) && place.curators.length > 0) {
    curatorCount = place.curators.length;
  }

  if (curatorCount >= 3) {
    return {
      level: "premium",
      fill: "#7c3aed",
      label: `${curatorCount}`,
    };
  }

  if (curatorCount === 2) {
    return {
      level: "hot",
      fill: "#ea580c",
      label: "2",
    };
  }

  return {
    level: "basic",
    fill: "#16a34a",
    label: "",
  };
}

// 폴더 기반 마커 색상 가져오기
function getFolderMarkerColor(place, userFolders) {
  const folderInfo = getFolderInfo(userFolders);
  
  if (folderInfo.primary) {
    return {
      fill: FOLDER_COLORS[folderInfo.primary.key],
      level: 'folder',
      emoji: folderInfo.primary.icon || '📌',
      folderInfo
    };
  }

  // 폴더가 없으면 기존 큐레이터 등급 시스템 사용
  return getMarkerTier(place);
}

/** SVG <text> / 속성용 이스케이프 */
function escapeSvgText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function checkinMarkerDecorations(size, checkinMeta) {
  const cc = Number(checkinMeta?.checkinCount) || 0;
  const showFlame = Boolean(checkinMeta?.showHotFlame);
  const topY = Math.min(18, Math.max(12, size * 0.36));
  const flameFs = Math.max(11, size * 0.3);
  const flame = showFlame
    ? `<text x="${size - 1}" y="${topY}" text-anchor="end" font-size="${flameFs}" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🔥</text>`
    : "";
  if (cc <= 0) return flame;
  const label = cc > 99 ? "99+" : String(cc);
  const pillH = Math.max(11, size * 0.32);
  const pillW = Math.max(26, size * 0.72);
  const pillY = size - pillH - 3;
  const pill = `
    <g>
      <rect x="${size / 2 - pillW / 2}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="#E11D48" stroke="#ffffff" stroke-width="1"/>
      <text x="${size / 2}" y="${pillY + pillH / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="8" font-weight="800" font-family="system-ui, Arial, sans-serif">${label}</text>
    </g>`;
  return flame + pill;
}

/** 직사각형 캔버스(핀)용 체크인 뱃지 */
function checkinMarkerDecorationsRect(w, h, checkinMeta) {
  const cc = Number(checkinMeta?.checkinCount) || 0;
  const showFlame = Boolean(checkinMeta?.showHotFlame);
  const topY = Math.min(17, Math.max(11, h * 0.32));
  const flameFs = Math.max(11, Math.min(14, h * 0.3));
  const flame = showFlame
    ? `<text x="${w - 1}" y="${topY}" text-anchor="end" font-size="${flameFs}" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🔥</text>`
    : "";
  if (cc <= 0) return flame;
  const label = cc > 99 ? "99+" : String(cc);
  const pillH = Math.max(11, h * 0.28);
  const pillW = Math.max(26, w * 0.72);
  const pillY = h - pillH - 2;
  const pill = `
    <g>
      <rect x="${w / 2 - pillW / 2}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="#E11D48" stroke="#ffffff" stroke-width="1"/>
      <text x="${w / 2}" y="${pillY + pillH / 2 + 1}" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="8" font-weight="800" font-family="system-ui, Arial, sans-serif">${label}</text>
    </g>`;
  return flame + pill;
}

/** 저장 폴더 전용 원형 마커 (큐레이터 등급 핀은 createMarkerImage 에서 buildCuratorPinSvg) */
function createMarkerSvg(
  place,
  isSelected,
  savedColor,
  isLive,
  userFolders,
  checkinMeta,
  shortCaption = ""
) {
  const markerInfo = getFolderMarkerColor(place, userFolders);
  const tier = markerInfo;

  const size = isSelected ? 48 : 38;
  const circleRadius = isSelected ? 15 : 13;
  const emojiFontSize = isSelected ? 14 : 12;
  /** 컬러 이모지 글리프가 원 중심보다 왼쪽으로 치우침 → 3시 방향으로 시각 보정 */
  const emojiOpticalX = isSelected ? 2 : 1.5;
  const emojiOpticalY = isSelected ? -0.5 : -0.5;
  const stroke = isSelected ? "rgba(255,255,255,0.95)" : "rgba(248,250,252,0.88)";
  const shadowOpacity = isSelected ? 0.26 : 0.16;

  // 폴더 기반 외곽 링
  let outerRing = "";
  if (tier.level === 'folder' && tier.folderInfo) {
    const { folderInfo } = tier;
    
    if (folderInfo.count >= 3) {
      // 3개 이상 폴더: 얇은 이중 링
      outerRing = `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 5}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5" />`;
    } else if (folderInfo.count === 2 && folderInfo.secondary) {
      // 2개 폴더: 이중 링
      const primaryColor = FOLDER_COLORS[folderInfo.primary.key];
      const secondaryColor = FOLDER_COLORS[folderInfo.secondary.key];
      outerRing = `
        <circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 4}" fill="none" stroke="${secondaryColor}" stroke-width="1.5" opacity="0.65" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 1.5}" fill="none" stroke="${primaryColor}" stroke-width="1.5" opacity="0.75" />
      `;
    }
    // 1개 폴더: 기본 링 (아래에서 처리)
  }

  const savedDot = savedColor
    ? `<circle cx="${size - 8}" cy="8" r="5" fill="${savedColor}" stroke="#ffffff" stroke-width="1.5" />`
    : "";

  const badgeR = tier.label && String(tier.label).length > 1 ? 7 : 6;
  const badgeFs = tier.label && String(tier.label).length > 1 ? 8 : 9;
  const overlapBadge =
    tier.label
      ? `
      <g>
        <circle cx="${size - 11}" cy="${size - 11}" r="${badgeR}" fill="#1a1d24" stroke="rgba(255,255,255,0.88)" stroke-width="1" />
        <text
          x="${size - 11}"
          y="${size - 11}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="${badgeFs}"
          font-weight="600"
          fill="#f8fafc"
          font-family="system-ui, -apple-system, Arial, sans-serif"
        >
          ${tier.label}
        </text>
      </g>
    `
    : tier.level === 'folder' && tier.folderInfo && tier.folderInfo.count >= 3
      ? `
      <g>
        <circle cx="${size - 11}" cy="${size - 11}" r="6" fill="#1a1d24" stroke="rgba(255,255,255,0.88)" stroke-width="1" />
        <text
          x="${size - 11}"
          y="${size - 11}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="8"
          font-weight="600"
          fill="#f8fafc"
          font-family="system-ui, -apple-system, Arial, sans-serif"
        >
          +${tier.folderInfo.count - 1}
        </text>
      </g>
    `
    : "";

  const premiumGlow = "";

  const liveRing = isLive
    ? `
      <circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 5}" fill="none" stroke="rgba(225,29,72,0.92)" stroke-width="2.2" />
    `
    : "";

  const liveBadge = isLive
    ? `
      <g>
        <text
          x="${size / 2}"
          y="11"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="10"
          font-weight="1000"
          fill="#E11D48"
          stroke="#ffffff"
          stroke-width="2.4"
          paint-order="stroke"
          font-family="Arial, sans-serif"
        >
          LIVE
        </text>
      </g>
    `
    : "";

  const courseCaptionRaw =
    place.isCoursePin && place.courseMapCaption
      ? String(place.courseMapCaption).trim().slice(0, 14)
      : "";
  const courseCaptionW = courseCaptionRaw
    ? Math.min(80, Math.max(52, courseCaptionRaw.length * 6 + 18))
    : 0;
  const courseRouteBadge = courseCaptionRaw
    ? `
      <g>
        <rect
          x="${size / 2 - courseCaptionW / 2}"
          y="2"
          width="${courseCaptionW}"
          height="15"
          rx="7.5"
          fill="#5b21b6"
          stroke="#ffffff"
          stroke-width="1.2"
        />
        <text
          x="${size / 2}"
          y="9.5"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="8.5"
          font-weight="800"
          fill="#ffffff"
          font-family="system-ui, -apple-system, Arial, sans-serif"
        >${escapeSvgText(courseCaptionRaw)}</text>
      </g>
    `
    : "";

  const capOnly = !courseCaptionRaw
    ? String(shortCaption || "").trim().slice(0, 8)
    : "";
  const capW = capOnly
    ? Math.min(82, capOnly.length * 7 + 14)
    : 0;
  const capBarH = capOnly ? 15 : 0;
  const bottomCaptionBar = capOnly
    ? `
      <g>
        <rect
          x="${size / 2 - capW / 2}"
          y="${size + 1}"
          width="${capW}"
          height="13"
          rx="6.5"
          fill="rgba(15,23,42,0.9)"
          stroke="rgba(255,255,255,0.88)"
          stroke-width="0.9"
        />
        <text
          x="${size / 2}"
          y="${size + 1 + 6.5}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="8"
          font-weight="800"
          fill="#ffffff"
          font-family="system-ui, -apple-system, Apple SD Gothic Neo, sans-serif"
        >${escapeSvgText(capOnly)}</text>
      </g>
    `
    : "";

  const svgH = size + capBarH;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${svgH}" viewBox="0 0 ${size} ${svgH}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="${shadowOpacity}" />
        </filter>
      </defs>

      <g filter="url(#shadow)">
        ${liveRing}
        ${outerRing}
        <circle
          cx="${size / 2}"
          cy="${size / 2}"
          r="${circleRadius}"
          fill="${tier.fill}"
          stroke="${stroke}"
          stroke-width="1.65"
        />

        ${premiumGlow}
        ${savedDot}
        ${overlapBadge}
        <g
          transform="translate(${size / 2 + emojiOpticalX}, ${
            size / 2 + emojiOpticalY
          })"
        >
          <text
            x="0"
            y="0"
            dominant-baseline="central"
            text-anchor="middle"
            font-size="${emojiFontSize}"
            font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
          >
            ${tier.emoji}
          </text>
        </g>
        ${liveBadge}
        ${courseRouteBadge}
        ${bottomCaptionBar}
        ${checkinMarkerDecorations(size, checkinMeta)}
      </g>
    </svg>
  `;
}

function createMarkerImage(
  place,
  isSelected,
  savedColor,
  isLive,
  userFolders,
  checkinMeta,
  mapShortCaption = ""
) {
  const meta = {
    checkinCount: Number(checkinMeta?.checkinCount) || 0,
    showHotFlame: Boolean(checkinMeta?.showHotFlame),
  };

  // 검색·카카오 API 전용 핀 (DB 큐레이터 추천은 아래 등급 마커 사용)
  // 코스 2차 후보(`courseMarkerPulse`): 큐레이터 추천집은 녹색 등급 마커+깜빡임, 그 외만 일반 핀
  const curatorListed = isCuratorListedPlace(place);
  const useKakaoGenericPin =
    !curatorListed &&
    (Boolean(place.isKakaoPlace) || Boolean(place.courseMarkerPulse));

  if (useKakaoGenericPin) {
    const name = place.name || place.place_name || '알 수 없는 장소';
    const nameSafe = escapeSvgText(name);
    const nameWidth = Math.min(name.length * 8 + 10, 120);
    const totalWidth = Math.max(30, nameWidth);
    const capK = String(mapShortCaption || "").trim().slice(0, 8);
    const capKW = capK
      ? Math.min(78, Math.max(36, capK.length * 7 + 12))
      : 0;
    const totalHeight = 35 + 25 + (capK ? 14 : 0); // 핀 + 상호명 라벨 + 선택 자막
    const kakaoFlame = meta.showHotFlame
      ? `<text x="${totalWidth - 2}" y="15" text-anchor="end" font-size="13" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🔥</text>`
      : "";
    const kakaoCount =
      meta.checkinCount > 0
        ? `<g><circle cx="${totalWidth - 10}" cy="${totalHeight * 0.22}" r="9" fill="#E11D48" stroke="#fff" stroke-width="1.5"/><text x="${totalWidth - 10}" y="${totalHeight * 0.22 + 1}" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-size="8" font-weight="800" font-family="Arial,sans-serif">${meta.checkinCount > 99 ? "99+" : meta.checkinCount}</text></g>`
        : "";
    
    // 카카오 기본 핀 + 상호명 라벨 SVG
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3" />
          </filter>
        </defs>
        ${kakaoFlame}
        ${kakaoCount}
        ${
          capK
            ? `<g>
          <rect
            x="${totalWidth / 2 - capKW / 2}"
            y="${totalHeight - 34}"
            width="${capKW}"
            height="12"
            rx="6"
            fill="rgba(124,58,237,0.94)"
            stroke="rgba(255,255,255,0.9)"
            stroke-width="0.85"
          />
          <text
            x="${totalWidth / 2}"
            y="${totalHeight - 27}"
            text-anchor="middle"
            font-size="8"
            font-weight="800"
            fill="#ffffff"
            font-family="system-ui, Apple SD Gothic Neo, sans-serif"
          >${escapeSvgText(capK)}</text>
        </g>`
            : ""
        }
        <!-- 상호명 라벨 (블랙 박스 + 흰 글씨) -->
        <rect
          x="${(totalWidth - nameWidth) / 2}"
          y="${totalHeight - 20}"
          width="${nameWidth}"
          height="16"
          rx="2"
          fill="#000000"
        />
        <text
          x="${totalWidth / 2}"
          y="${totalHeight - 8}"
          text-anchor="middle"
          font-size="11"
          font-family="Arial, sans-serif"
          fill="#ffffff"
          font-weight="bold"
        >
          ${nameSafe}
        </text>
        
        <!-- 카카오 기본 빨간 핀 모양 -->
        <g filter="url(#shadow)">
          <path
            d="M ${totalWidth/2} ${totalHeight*0.15}
               C ${totalWidth/2} ${totalHeight*0.15}, ${totalWidth/2 - totalHeight*0.15} ${totalHeight*0.15}, ${totalWidth/2 - totalHeight*0.15} ${totalHeight*0.35}
               C ${totalWidth/2 - totalHeight*0.15} ${totalHeight*0.45}, ${totalWidth/2 - totalHeight*0.05} ${totalHeight*0.55}, ${totalWidth/2} ${totalHeight*0.75}
               C ${totalWidth/2 + totalHeight*0.05} ${totalHeight*0.55}, ${totalWidth/2 + totalHeight*0.15} ${totalHeight*0.45}, ${totalWidth/2 + totalHeight*0.15} ${totalHeight*0.35}
               C ${totalWidth/2 + totalHeight*0.15} ${totalHeight*0.15}, ${totalWidth/2} ${totalHeight*0.15}, ${totalWidth/2} ${totalHeight*0.15}
               Z"
            fill="${isSelected ? '#CC0000' : '#FF4444'}"
          />
          <!-- 내부 원 -->
          <circle
            cx="${totalWidth/2}"
            cy="${totalHeight*0.35}"
            r="${totalHeight*0.08}"
            fill="white"
          />
        </g>
      </svg>
    `;
    
    // 카카오 마커 이미지 생성 — 앵커는 핀 끝(좌표). 맨 아래(상호 라벨 끝)로 두면 전부 북쪽으로 밀려 2시 방향처럼 보임
    try {
      if (window.kakao?.maps?.MarkerImage) {
        const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
        const pinTipY = Math.round(totalHeight * 0.75);
        return new window.kakao.maps.MarkerImage(
          encoded,
          new window.kakao.maps.Size(totalWidth, totalHeight),
          {
            offset: new window.kakao.maps.Point(totalWidth / 2, pinTipY),
          }
        );
      }
    } catch (error) {
      console.error('마커 이미지 생성 오류:', error);
    }
    
    // fallback: 기본 마커 사용
    return null;
  }

  const folderMarkerInfo = getFolderMarkerColor(place, userFolders);
  const folderMode = folderMarkerInfo.level === "folder";

  if (!folderMode) {
    const pin = buildCuratorPinSvg({
      tier: getMarkerTier(place),
      isSelected,
      savedColor,
      isLive,
      place,
      mapShortCaption,
      checkinMarkerDecorationsSvg: checkinMarkerDecorationsRect(
        isSelected ? 42 : 34,
        isSelected ? 50 : 40,
        meta
      ),
      shadowOpacity: isSelected ? 0.26 : 0.17,
    });
    const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      pin.svg
    )}`;
    return new window.kakao.maps.MarkerImage(
      encoded,
      new window.kakao.maps.Size(pin.width, pin.height),
      {
        offset: new window.kakao.maps.Point(pin.width / 2, pin.height),
      }
    );
  }

  const capForFolder = String(mapShortCaption || "").trim().slice(0, 8);
  const svg = createMarkerSvg(
    place,
    isSelected,
    savedColor,
    isLive,
    userFolders,
    meta,
    capForFolder
  );
  const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  const size = isSelected ? 48 : 38;
  const capBarH = !place?.isCoursePin && capForFolder ? 15 : 0;
  const svgH = size + capBarH;

  return new window.kakao.maps.MarkerImage(
    encoded,
    new window.kakao.maps.Size(size, svgH),
    {
      offset: new window.kakao.maps.Point(size / 2, size / 2),
    }
  );
}

export default function createMarker({
  map,
  place,
  isSelected = false,
  isLive = false,
  savedColor = null,
  userFolders = null, // 추가
  /** @type {{ checkinCount?: number, showHotFlame?: boolean }} */
  checkinMeta,
  /** 지도 위 짧은 자막 (한글 8자 이내) — 모바일 가시 */
  mapShortCaption = "",
  onClick,
}) {
  const meta = {
    checkinCount: Number(checkinMeta?.checkinCount) || 0,
    showHotFlame: Boolean(checkinMeta?.showHotFlame),
  };
  const marker = new window.kakao.maps.Marker({
    map,
    position: new window.kakao.maps.LatLng(place.lat, place.lng),
    image: createMarkerImage(
      place,
      isSelected,
      savedColor,
      isLive,
      userFolders,
      meta,
      mapShortCaption
    ),
    zIndex: isSelected ? 20 : 1,
  });

  const placeName = String(place?.name || "장소").trim() || "장소";
  let hoverTitle = `${placeName} · 주도`;
  if (meta.checkinCount > 0) {
    hoverTitle = `${placeName} · 오늘 ${meta.checkinCount}명 한잔`;
  } else if (meta.showHotFlame) {
    hoverTitle = `${placeName} · 🔥 오늘 핫한 술집`;
  }
  if (typeof marker.setTitle === "function") {
    marker.setTitle(hoverTitle);
  }

  window.kakao.maps.event.addListener(marker, "click", () => {
    if (typeof onClick === "function") {
      onClick(place);
    }
  });

  return marker;
}