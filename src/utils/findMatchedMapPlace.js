import { nameMatches } from "./isHighlightedPlace.js";

export function findMatchedMapPlace(selectedRecommendedPlace, mapPlaces) {
  if (!selectedRecommendedPlace || !Array.isArray(mapPlaces)) return null;

  const sel = selectedRecommendedPlace?.name;
  if (!sel) return null;

  for (const p of mapPlaces) {
    if (nameMatches(sel, p?.name)) return p;
  }

  return null;
}
