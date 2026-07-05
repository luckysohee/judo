import {
  getMarkerTier,
  isCourseBridgeMapPin,
  isCuratorListedPlace,
} from "./mapMarkerTier.js";
import { isResolvableCourseStepThumbUrl } from "./courseStepThumb.js";
import { resolvePlaceWgs84 } from "./placeCoords.js";
import {
  buildCourseVenueNameLabelForMarker,
  shouldShowCourseStepRouteBadge,
} from "./mapMarkerVenueLabel.js";

/** 카카오 level — 숫자가 작을수록 확대. 이 값 이하에서 큐레이터 픽 사진 마커 */
export const MAP_PHOTO_CIRCLE_MARKER_MAX_LEVEL = 6;

export function resolvePlaceMarkerPhotoUrl(place) {
  if (!place || typeof place !== "object") return null;
  const candidates = [
    place.courseStepThumbUrl,
    place.step_image_url,
    place.image_url,
    place.image,
    place.thumbnail_url,
    place.thumbnail,
    place.photo_url,
  ];
  for (const raw of candidates) {
    const url = String(raw || "").trim();
    if (isResolvableCourseStepThumbUrl(url)) return url;
  }
  return null;
}

/**
 * @param {object} place
 * @param {{ isSelected?: boolean, mapZoomLevel?: number }} [opts]
 */
export function shouldUsePhotoCircleMarker(
  place,
  { isSelected = false, mapZoomLevel = 8 } = {}
) {
  if (!resolvePlaceMarkerPhotoUrl(place)) return false;

  if (place?.isCoursePin && !isCourseBridgeMapPin(place)) return true;

  if (isCuratorListedPlace(place)) {
    if (isSelected) return true;
    const lv = Number(mapZoomLevel);
    if (Number.isFinite(lv) && lv <= MAP_PHOTO_CIRCLE_MARKER_MAX_LEVEL) {
      return true;
    }
  }

  return false;
}

function appendCheckinBadges(host, checkinMeta, size) {
  const cc = Number(checkinMeta?.checkinCount) || 0;
  const showFlame = Boolean(checkinMeta?.showHotFlame);
  if (showFlame) {
    const flame = document.createElement("span");
    flame.textContent = "🔥";
    flame.style.cssText = `position:absolute;top:-2px;right:-2px;font-size:${Math.max(11, size * 0.28)}px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));`;
    host.appendChild(flame);
  }
  if (cc <= 0) return;
  const pill = document.createElement("span");
  pill.textContent = cc > 99 ? "99+" : String(cc);
  pill.style.cssText = [
    "position:absolute",
    "left:50%",
    "bottom:-5px",
    "transform:translateX(-50%)",
    "min-width:22px",
    "padding:1px 5px",
    "border-radius:999px",
    "background:#E11D48",
    "color:#fff",
    "font-size:8px",
    "font-weight:800",
    "line-height:1.2",
    "border:1px solid #fff",
    "box-shadow:0 1px 3px rgba(0,0,0,0.18)",
    "font-family:system-ui,-apple-system,sans-serif",
  ].join(";");
  host.appendChild(pill);
}

function appendTierBadge(host, tier, size) {
  if (!tier?.label) return;
  const badge = document.createElement("span");
  badge.textContent = String(tier.label);
  badge.style.cssText = [
    "position:absolute",
    `right:${Math.round(size * 0.02)}px`,
    `bottom:${Math.round(size * 0.02)}px`,
    "min-width:14px",
    "height:14px",
    "padding:0 3px",
    "border-radius:999px",
    "background:#0f172a",
    "color:#f8fafc",
    "font-size:8px",
    "font-weight:700",
    "line-height:14px",
    "text-align:center",
    "border:1px solid rgba(255,255,255,0.88)",
    "font-family:system-ui,-apple-system,sans-serif",
  ].join(";");
  host.appendChild(badge);
}

function appendCourseStepBadge(host, place, size) {
  if (!shouldShowCourseStepRouteBadge(place)) return;
  const raw = String(place.courseMapCaption || "").trim().slice(0, 14);
  if (!raw) return;
  const badge = document.createElement("span");
  badge.textContent = raw;
  badge.style.cssText = [
    "position:absolute",
    "top:-8px",
    "left:50%",
    "transform:translateX(-50%)",
    "max-width:84px",
    "padding:2px 7px",
    "border-radius:999px",
    "background:#171717",
    "color:#fff",
    "font-size:8px",
    "font-weight:800",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "border:1px solid rgba(255,255,255,0.9)",
    "font-family:system-ui,Apple SD Gothic Neo,sans-serif",
  ].join(";");
  host.appendChild(badge);
}

/**
 * 사진 원형 마커 — CustomOverlay (클러스터·MarkerImage와 동일 setMap/setOpacity)
 */
export function createPhotoCircleMarker({
  map,
  place,
  isSelected = false,
  isLive = false,
  savedColor = null,
  checkinMeta,
  mapShortCaption = "",
  onClick,
}) {
  if (!window.kakao?.maps?.CustomOverlay || !window.kakao?.maps?.LatLng) {
    return null;
  }

  const photoUrl = resolvePlaceMarkerPhotoUrl(place);
  if (!photoUrl) return null;

  const wgs = resolvePlaceWgs84(place);
  const lat = wgs?.lat ?? Number(place?.lat);
  const lng = wgs?.lng ?? Number(place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const tier = getMarkerTier(place);
  const size = isSelected ? 48 : 40;
  const borderW = isSelected ? 3 : 2.5;
  const ringColor = tier?.fill || "#16a34a";

  const root = document.createElement("div");
  root.style.cssText =
    "position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;touch-action:manipulation;";

  const circleWrap = document.createElement("div");
  circleWrap.style.cssText = "position:relative;";

  const circle = document.createElement("div");
  circle.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:50%",
    `background-image:url("${photoUrl.replace(/"/g, '\\"')}")`,
    "background-size:cover",
    "background-position:center",
    "background-color:#e2e8f0",
    `border:${borderW}px solid ${ringColor}`,
    "box-shadow:0 2px 10px rgba(15,23,42,0.22), inset 0 0 0 1.5px rgba(255,255,255,0.88)",
    isLive ? "outline:2px solid rgba(225,29,72,0.92);outline-offset:1px;" : "",
    isSelected ? "transform:scale(1.04);" : "",
  ].join(";");

  if (savedColor) {
    const dot = document.createElement("span");
    dot.style.cssText = `position:absolute;top:2px;right:2px;width:9px;height:9px;border-radius:50%;background:${savedColor};border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.2);`;
    circleWrap.appendChild(dot);
  }

  circleWrap.appendChild(circle);
  appendTierBadge(circleWrap, tier, size);
  appendCourseStepBadge(circleWrap, place, size);
  appendCheckinBadges(circleWrap, checkinMeta, size);
  root.appendChild(circleWrap);

  const cap = String(mapShortCaption || "").trim().slice(0, 8);
  if (cap && !place?.isCoursePin) {
    const capEl = document.createElement("span");
    capEl.textContent = cap;
    capEl.style.cssText = [
      "margin-top:3px",
      "max-width:82px",
      "padding:2px 7px",
      "border-radius:999px",
      "background:rgba(15,23,42,0.9)",
      "color:#fff",
      "font-size:8px",
      "font-weight:800",
      "white-space:nowrap",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "border:1px solid rgba(255,255,255,0.85)",
      "font-family:system-ui,Apple SD Gothic Neo,sans-serif",
    ].join(";");
    root.appendChild(capEl);
  }

  if (place?.isCoursePin) {
    const venueLabel = buildCourseVenueNameLabelForMarker(
      size / 2,
      size + 1,
      place,
      size
    );
    if (venueLabel?.svg) {
      const labelHost = document.createElement("div");
      labelHost.style.cssText = `margin-top:2px;width:${venueLabel.totalW}px;height:${venueLabel.height}px;`;
      labelHost.innerHTML = venueLabel.svg;
      root.appendChild(labelHost);
    }
  }

  const meta = {
    checkinCount: Number(checkinMeta?.checkinCount) || 0,
    showHotFlame: Boolean(checkinMeta?.showHotFlame),
  };

  let zIndex = isSelected
    ? 22
    : meta.showHotFlame || meta.checkinCount > 0
      ? 20
      : place?.isCoursePin
        ? 14
        : 12;

  const overlay = new window.kakao.maps.CustomOverlay({
    map,
    position: new window.kakao.maps.LatLng(lat, lng),
    content: root,
    yAnchor: 0.92,
    xAnchor: 0.5,
    zIndex,
  });

  root.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onClick === "function") onClick(place);
  });

  const placeName = String(place?.name || place?.place_name || "장소").trim();
  root.title = placeName;

  return {
    setMap(nextMap) {
      overlay.setMap(nextMap);
    },
    setOpacity(op) {
      root.style.opacity = String(op);
    },
    setZIndex(next) {
      zIndex = next;
      if (typeof overlay.setZIndex === "function") overlay.setZIndex(next);
    },
  };
}
