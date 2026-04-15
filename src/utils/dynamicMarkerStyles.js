// 마커 스타일 동적 변경 함수 (체크인 데이터는 호출부에서 넘기면 핫플/배지 반영)
export const getDynamicMarkerStyle = (
  place,
  userFolders = [],
  savedColorMap = {},
  { hotPlaces = [], placeCheckinCounts = {} } = {}
) => {
  
  // 기존 마커 스타일 로직
  const baseStyle = getBaseMarkerStyle(place, userFolders, savedColorMap);
  
  // 핫플레이스 여부 확인
  const isHotPlace = hotPlaces.some(hotPlace => hotPlace.place_id === place.id);
  const checkinCount = placeCheckinCounts[place.id] || 0;
  
  // 동적 스타일 적용
  return {
    ...baseStyle,
    // 핫플레이스 스타일 추가
    hotPlace: {
      isHotPlace,
      checkinCount,
      glowEffect: isHotPlace ? {
        color: '#FF6B6B',
        intensity: Math.min(checkinCount / 5, 1), // 최대 1.0
        animation: 'pulse 2s ease-in-out infinite'
      } : null,
      fireIcon: isHotPlace ? {
        emoji: '🔥',
        position: { top: '-8px', right: '-8px' },
        size: '20px',
        animation: 'flicker 1.5s ease-in-out infinite'
      } : null
    },
    // 체크인 수 표시
    checkinBadge: checkinCount > 0 ? {
      text: `${checkinCount}`,
      position: { bottom: '8px', right: '8px' },
      backgroundColor: '#FF6B6B',
      color: 'white',
      fontSize: '10px',
      fontWeight: 'bold',
      padding: '2px 6px',
      borderRadius: '10px',
      border: '1px solid white'
    } : null
  };
};

// 기존 마커 스타일 로직 (createMarker.js에서 가져옴)
const getBaseMarkerStyle = (place, userFolders = [], savedColorMap = {}) => {
  const FOLDER_COLORS = {
    after_party: '#FF8C42',
    date: '#FF69B4',
    hangover: '#87CEEB',
    solo: '#9B59B6',
    group: '#F1C40F',
    must_go: '#27AE60',
    terrace: '#2C3E50'
  };

  // 큐레이터 등급 마커
  const getMarkerTier = (place) => {
    const curatorCount = Array.isArray(place?.curators) ? place.curators.length : 1;

    if (curatorCount >= 3) {
      return {
        level: "premium",
        fill: "#F5C451",
        emoji: "👑",
        label: `${curatorCount}`,
      };
    } else if (curatorCount >= 2) {
      return {
        level: "hot",
        fill: "#8B5CF6",
        emoji: "⭐",
        label: `${curatorCount}`,
      };
    } else {
      return {
        level: "basic",
        fill: "#3B82F6",
        emoji: "",
        label: "",
      };
    }
  };

  // 저장된 색상 가져오기
  const savedColor = savedColorMap[place.id];

  // 폴더 정보 가져오기
  const getFolderInfo = (folders = []) => {
    if (!folders || folders.length === 0) {
      return { primary: null, secondary: null, count: 0 };
    }

    const validFolders = folders.filter(f => FOLDER_COLORS[f.key]);
    const count = validFolders.length;

    if (count === 0) {
      return { primary: null, secondary: null, count: 0 };
    }

    const sortedFolders = validFolders.sort((a, b) => {
      const priority = { after_party: 1, date: 2, hangover: 3, solo: 4, group: 5, must_go: 6, terrace: 7 };
      return (priority[a.key] || 999) - (priority[b.key] || 999);
    });

    return {
      primary: sortedFolders[0],
      secondary: sortedFolders[1],
      count
    };
  };

  const tier = getMarkerTier(place);
  const folderInfo = getFolderInfo(userFolders);

  return {
    tier,
    folderInfo,
    savedColor,
    primaryColor: folderInfo.primary ? FOLDER_COLORS[folderInfo.primary.key] : tier.fill,
    secondaryColor: folderInfo.secondary ? FOLDER_COLORS[folderInfo.secondary.key] : null,
    size: 48,
    circleRadius: 14
  };
};

// 마커 SVG 생성 함수 (핫플레이스 스타일 포함)
export const createDynamicMarkerSVG = (
  place,
  userFolders = [],
  savedColorMap = {},
  checkinSnapshot = {}
) => {
  const style = getDynamicMarkerStyle(
    place,
    userFolders,
    savedColorMap,
    checkinSnapshot
  );
  const { size, circleRadius, tier, savedColor, primaryColor, secondaryColor, hotPlace, checkinBadge } = style;
  
  // 기본 SVG 구조
  let svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- 그림자 -->
      <ellipse cx="${size/2}" cy="${size-4}" rx="${circleRadius-2}" ry="3" fill="rgba(0,0,0,0.2)" />
      
      <!-- 핫플레이스 Glow 효과 -->
      ${hotPlace.glowEffect ? `
        <defs>
          <radialGradient id="glow-${place.id}">
            <stop offset="0%" stop-color="${hotPlace.glowEffect.color}" stop-opacity="${hotPlace.glowEffect.intensity * 0.6}" />
            <stop offset="50%" stop-color="${hotPlace.glowEffect.color}" stop-opacity="${hotPlace.glowEffect.intensity * 0.3}" />
            <stop offset="100%" stop-color="${hotPlace.glowEffect.color}" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="${size/2}" cy="${size/2}" r="${circleRadius + 8}" fill="url(#glow-${place.id})" />
        <circle cx="${size/2}" cy="${size/2}" r="${circleRadius + 8}" fill="none" stroke="${hotPlace.glowEffect.color}" stroke-width="2" opacity="${hotPlace.glowEffect.intensity * 0.8}" />
      ` : ''}
      
      <!-- 바깥 링 -->
      ${secondaryColor ? `
        <circle cx="${size/2}" cy="${size/2}" r="${circleRadius + 5}" fill="none" stroke="${secondaryColor}" stroke-width="3" opacity="0.7" />
        <circle cx="${size/2}" cy="${size/2}" r="${circleRadius + 2}" fill="none" stroke="${primaryColor}" stroke-width="2" opacity="0.8" />
      ` : tier.level === "premium" ? `
        <circle cx="${size/2}" cy="${size/2}" r="${circleRadius + 6}" fill="none" stroke="rgba(245,196,81,0.45)" stroke-width="4" />
      ` : tier.level === "hot" ? `
        <circle cx="${size/2}" cy="${size/2}" r="${circleRadius + 5}" fill="none" stroke="rgba(139,92,246,0.35)" stroke-width="3" />
      ` : ''}
      
      <!-- 메인 원 -->
      <circle cx="${size/2}" cy="${size/2}" r="${circleRadius}" fill="${primaryColor}" stroke="white" stroke-width="2" />
      
      <!-- 저장된 점 -->
      ${savedColor ? `
        <circle cx="${size - 11}" cy="11" r="6.5" fill="${savedColor}" stroke="#ffffff" stroke-width="2" />
      ` : ''}
      
      <!-- 큐레이터 배지 -->
      ${tier.label ? `
        <g>
          <circle cx="${size - 14}" cy="${size - 14}" r="9" fill="#111111" stroke="#ffffff" stroke-width="1.5" />
          <text x="${size - 14}" y="${size - 14}" dominant-baseline="central" text-anchor="middle" font-size="10" font-weight="700" fill="#ffffff" font-family="Arial, sans-serif">
            ${tier.label}
          </text>
        </g>
      ` : ''}
      
      <!-- 체크인 수 배지 -->
      ${checkinBadge ? `
        <g>
          <rect x="${size - 20}" y="${size - 16}" width="16" height="12" rx="6" fill="${checkinBadge.backgroundColor}" stroke="${checkinBadge.border}" stroke-width="1" />
          <text x="${size - 12}" y="${size - 8}" dominant-baseline="central" text-anchor="middle" font-size="${checkinBadge.fontSize}" font-weight="${checkinBadge.fontWeight}" fill="${checkinBadge.color}" font-family="Arial, sans-serif">
            ${checkinBadge.text}
          </text>
        </g>
      ` : ''}
      
      <!-- 이모지 -->
      ${tier.emoji ? `
        <text x="${size/2}" y="${size/2 + 1}" dominant-baseline="central" text-anchor="middle" font-size="16" font-family="Arial, sans-serif">
          ${tier.emoji}
        </text>
      ` : ''}
    </svg>
  `;

  return svg;
};

// CSS 애니메이션 생성 함수
export const generateMarkerAnimations = () => {
  return `
    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.2); opacity: 0.3; }
      100% { transform: scale(1); opacity: 0.6; }
    }
    
    @keyframes flicker {
      0%, 100% { opacity: 1; transform: scale(1); }
      25% { opacity: 0.8; transform: scale(1.1); }
      50% { opacity: 0.9; transform: scale(0.95); }
      75% { opacity: 0.7; transform: scale(1.05); }
    }
    
    @keyframes glow {
      0% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.8); }
      50% { box-shadow: 0 0 20px rgba(255, 107, 107, 0.6), 0 0 30px rgba(255, 107, 107, 0.4); }
      100% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.8); }
    }
  `;
};
