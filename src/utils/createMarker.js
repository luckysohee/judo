import { useRealtimeCheckins } from '../hooks/useRealtimeCheckins';

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

// 큐레이터 등급 마커 (기존 로직 유지)
function getMarkerTier(place) {
  const curatorCount = Array.isArray(place?.curators) ? place.curators.length : 1;

  if (curatorCount >= 3) {
    return {
      level: "premium",
      fill: "#F5C451",
      emoji: "👑",
      label: `${curatorCount}`,
    };
  }

  if (curatorCount === 2) {
    return {
      level: "hot", 
      fill: "#8B5CF6",
      emoji: "✨",
      label: "2",
    };
  }

  return {
    level: "basic",
    fill: "#2ECC71", // 초록색으로 복원
    emoji: "🍶",
    label: "",
  };
}

// 카카오 카테고리별 마커 아이콘 매핑
const KAKAO_CATEGORY_ICONS = {
  '음식점': '🍽️',
  '술집': '🍺', 
  '카페': '☕',
  '한식': '🍚',
  '양식': '🍝',
  '일식': '🍱',
  '중식': '🥡',
  '분식': '🥟',
  '치킨': '🍗',
  '피자': '🍕',
  '햄버거': '🍔',
  '아시아음식': '🥘',
  '제과': '🍰',
  '베이커리': '🥖',
  '패스트푸드': '🍟',
  '주점': '🍻',
  '이자카야': '🏮',
  '포장마차': '🚐',
  '육류': '🥩',
  '해산물': '🦐',
  '채소': '🥬',
  '과일': '🍎'
};

// 카카오 카테고리에서 아이콘 가져오기
function getKakaoCategoryIcon(category) {
  if (!category) return '📍';
  
  // 카테고리 문자열에 포함된 키워드로 아이콘 찾기
  for (const [key, icon] of Object.entries(KAKAO_CATEGORY_ICONS)) {
    if (category.includes(key)) {
      return icon;
    }
  }
  
  return '📍'; // 기본 아이콘
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

function createMarkerSvg(place, isSelected, savedColor, isLive, userFolders) {
  // 폴더 기반 마커 정보 우선 사용
  const markerInfo = getFolderMarkerColor(place, userFolders);
  const tier = markerInfo.level === 'folder' ? markerInfo : getMarkerTier(place);

  const size = isSelected ? 64 : 50;
  const circleRadius = isSelected ? 22 : 18;
  const emojiFontSize = isSelected ? 18 : 15;
  const stroke = isSelected ? "#ffffff" : "#f3f3f3";
  const shadowOpacity = isSelected ? 0.34 : 0.2;

  // 폴더 기반 외곽 링
  let outerRing = "";
  if (tier.level === 'folder' && tier.folderInfo) {
    const { folderInfo } = tier;
    
    if (folderInfo.count >= 3) {
      // 3개 이상 폴더: 두꺼운 링 + "+N"
      outerRing = `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 6}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4" />`;
    } else if (folderInfo.count === 2 && folderInfo.secondary) {
      // 2개 폴더: 이중 링
      const primaryColor = FOLDER_COLORS[folderInfo.primary.key];
      const secondaryColor = FOLDER_COLORS[folderInfo.secondary.key];
      outerRing = `
        <circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 5}" fill="none" stroke="${secondaryColor}" stroke-width="3" opacity="0.7" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 2}" fill="none" stroke="${primaryColor}" stroke-width="2" opacity="0.8" />
      `;
    }
    // 1개 폴더: 기본 링 (아래에서 처리)
  } else {
    // 기존 큐레이터 등급 시스템
    outerRing =
      tier.level === "premium"
        ? `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 6}" fill="none" stroke="rgba(245,196,81,0.45)" stroke-width="4" />`
        : tier.level === "hot"
        ? `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 5}" fill="none" stroke="rgba(139,92,246,0.35)" stroke-width="3" />`
        : "";
  }

  const savedDot = savedColor
    ? `<circle cx="${size - 11}" cy="11" r="6.5" fill="${savedColor}" stroke="#ffffff" stroke-width="2" />`
    : "";

  const overlapBadge =
    tier.label
      ? `
      <g>
        <circle cx="${size - 14}" cy="${size - 14}" r="9" fill="#111111" stroke="#ffffff" stroke-width="1.5" />
        <text
          x="${size - 14}"
          y="${size - 14}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="10"
          font-weight="700"
          fill="#ffffff"
          font-family="Arial, sans-serif"
        >
          ${tier.label}
        </text>
      </g>
    `
    : tier.level === 'folder' && tier.folderInfo && tier.folderInfo.count >= 3
      ? `
      <g>
        <circle cx="${size - 14}" cy="${size - 14}" r="9" fill="#111111" stroke="#ffffff" stroke-width="1.5" />
        <text
          x="${size - 14}"
          y="${size - 14}"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="9"
          font-weight="700"
          fill="#ffffff"
          font-family="Arial, sans-serif"
        >
          +${tier.folderInfo.count - 1}
        </text>
      </g>
    `
    : "";

  const premiumGlow =
    tier.level === "premium"
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 1}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" />`
      : "";

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

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="${shadowOpacity}" />
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
          stroke-width="2.5"
        />

        ${premiumGlow}
        ${savedDot}
        ${overlapBadge}
        <text
          x="50%"
          y="50%"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="${emojiFontSize}"
          font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
        >
          ${tier.emoji}
        </text>
        ${liveBadge}
      </g>
    </svg>
  `;
}

function createMarkerImage(place, isSelected, savedColor, isLive, userFolders) {
  // 카카오 장소는 간단한 SVG 마커 사용
  if (place.isKakaoPlace) {
    const nameWidth = Math.min(place.name.length * 8 + 10, 120);
    const totalWidth = Math.max(30, nameWidth);
    const totalHeight = 35 + 25;
    
    // 간단한 빨간색 핀 SVG + 가게 이름
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3" />
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <!-- 핀 모양 (테두리 없음) -->
          <path
            d="M ${totalWidth/2} 5
               C ${totalWidth/2} 5, ${totalWidth/2 - 10} 5, ${totalWidth/2 - 10} 15
               C ${totalWidth/2 - 10} 20, ${totalWidth/2 - 5} 25, ${totalWidth/2} 35
               C ${totalWidth/2 + 5} 25, ${totalWidth/2 + 10} 20, ${totalWidth/2 + 10} 15
               C ${totalWidth/2 + 10} 5, ${totalWidth/2} 5, ${totalWidth/2} 5
               Z"
            fill="${isSelected ? '#CC0000' : '#FF4444'}"
          />
          <circle
            cx="${totalWidth/2}"
            cy="15"
            r="3"
            fill="#ffffff"
          />
          <!-- 가게 이름 (네모 블랙박스에 흰글씨) -->
          <rect
            x="${(totalWidth - nameWidth) / 2 - 4}"
            y="43"
            width="${nameWidth + 8}"
            height="16"
            fill="#000000"
            rx="2"
          />
          <text
            x="${totalWidth/2}"
            y="51"
            dominant-baseline="central"
            text-anchor="middle"
            font-size="11"
            font-family="Arial, sans-serif"
            fill="#ffffff"
            font-weight="bold"
          >
            ${place.name}
          </text>
        </g>
      </svg>
    `;
    
    const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`;
    
    return new window.kakao.maps.MarkerImage(
      encoded,
      new window.kakao.maps.Size(totalWidth, totalHeight),
      {
        offset: new window.kakao.maps.Point(totalWidth / 2, totalHeight)
      }
    );
  }
  
  // 기존 큐레이터 마커 로직
  const svg = createMarkerSvg(place, isSelected, savedColor, isLive, userFolders);
  const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  const size = isSelected ? 64 : 50;

  return new window.kakao.maps.MarkerImage(
    encoded,
    new window.kakao.maps.Size(size, size),
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
  onClick,
}) {
  const marker = new window.kakao.maps.Marker({
    map,
    position: new window.kakao.maps.LatLng(place.lat, place.lng),
    image: createMarkerImage(place, isSelected, savedColor, isLive, userFolders),
    zIndex: isSelected ? 20 : 1,
  });

  window.kakao.maps.event.addListener(marker, "click", () => {
    if (typeof onClick === "function") {
      onClick(place);
    }
  });

  return marker;
}