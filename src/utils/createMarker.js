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
    fill: "#2ECC71",
    emoji: "🍶",
    label: "",
  };
}

function createMarkerSvg(place, isSelected, savedColor) {
  const tier = getMarkerTier(place);

  const size = isSelected ? 64 : 50;
  const circleRadius = isSelected ? 22 : 18;
  const emojiFontSize = isSelected ? 18 : 15;
  const stroke = isSelected ? "#ffffff" : "#f3f3f3";
  const shadowOpacity = isSelected ? 0.34 : 0.2;

  const outerRing =
    tier.level === "premium"
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 6}" fill="none" stroke="rgba(245,196,81,0.45)" stroke-width="4" />`
      : tier.level === "hot"
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 5}" fill="none" stroke="rgba(139,92,246,0.35)" stroke-width="3" />`
      : "";

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
      : "";

  const premiumGlow =
    tier.level === "premium"
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius + 1}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" />`
      : "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="${shadowOpacity}" />
        </filter>
      </defs>

      <g filter="url(#shadow)">
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
      </g>
    </svg>
  `;
}

function createMarkerImage(place, isSelected, savedColor) {
  const svg = createMarkerSvg(place, isSelected, savedColor);
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
  savedColor = null,
  onClick,
}) {
  const marker = new window.kakao.maps.Marker({
    map,
    position: new window.kakao.maps.LatLng(place.lat, place.lng),
    image: createMarkerImage(place, isSelected, savedColor),
    zIndex: isSelected ? 20 : 1,
  });

  window.kakao.maps.event.addListener(marker, "click", () => {
    if (typeof onClick === "function") {
      onClick(place);
    }
  });

  return marker;
}