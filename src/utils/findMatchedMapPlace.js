import { nameMatches } from "./isHighlightedPlace.js";

function mapPlaceDisplayName(p) {
  return p?.name || p?.display_name || p?.place_name || "";
}

export function findMatchedMapPlace(selectedRecommendedPlace, mapPlaces) {
  if (!selectedRecommendedPlace || !Array.isArray(mapPlaces)) return null;

  const sel =
    selectedRecommendedPlace?.name ||
    selectedRecommendedPlace?.place_name ||
    selectedRecommendedPlace?.title ||
    "";
  if (!sel) return null;

  for (const p of mapPlaces) {
    if (nameMatches(sel, mapPlaceDisplayName(p))) return p;
  }

  return null;
}
