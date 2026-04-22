import { isHighlightedPlace } from "./isHighlightedPlace.js";

const NORMAL_MARKER_STYLE = {
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  border: "2px solid #ffffff",
  backgroundColor: "#e11d48",
  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.28)",
};

const HIGHLIGHTED_MARKER_STYLE = {
  width: "15px",
  height: "15px",
  borderRadius: "50%",
  border: "3px solid #fbbf24",
  backgroundColor: "#dc2626",
  boxShadow:
    "0 0 0 2px rgba(251, 191, 36, 0.45), 0 0 14px rgba(251, 191, 36, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35)",
};

export function getMarkerStyle(place, highlightedPlaces) {
  if (isHighlightedPlace(place, highlightedPlaces)) {
    return HIGHLIGHTED_MARKER_STYLE;
  }
  return NORMAL_MARKER_STYLE;
}
