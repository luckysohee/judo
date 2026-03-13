function createMarkerSvg(color, isSelected, savedColor) {
  const size = isSelected ? 52 : 44;
  const circleRadius = isSelected ? 22 : 18;
  const emojiFontSize = isSelected ? 18 : 16;
  const stroke = isSelected ? "#ffffff" : "#f3f3f3";
  const shadowOpacity = isSelected ? 0.28 : 0.18;

  const savedDot = savedColor
    ? `<circle cx="${size - 10}" cy="10" r="6" fill="${savedColor}" stroke="#ffffff" stroke-width="2" />`
    : "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius}" fill="${color}" stroke="${stroke}" stroke-width="2" />
        ${savedDot}
        <text
          x="50%"
          y="50%"
          dominant-baseline="central"
          text-anchor="middle"
          font-size="${emojiFontSize}"
          font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
        >
          🍶
        </text>
      </g>
    </svg>
  `;
}

function createMarkerImage(color, isSelected, savedColor) {
  const svg = createMarkerSvg(color, isSelected, savedColor);
  const encoded = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  const size = isSelected ? 52 : 44;

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
  color = "#2ECC71",
  isSelected = false,
  savedColor = null,
  onClick,
}) {
  const marker = new window.kakao.maps.Marker({
    map,
    position: new window.kakao.maps.LatLng(place.lat, place.lng),
    image: createMarkerImage(color, isSelected, savedColor),
  });

  window.kakao.maps.event.addListener(marker, "click", () => {
    if (typeof onClick === "function") {
      onClick(place);
    }
  });

  return marker;
}