import { isHighlightedPlace } from "./isHighlightedPlace.js";

export function sortPlacesForMarkerRender(mapPlaces, highlightedPlaces) {
  if (!Array.isArray(mapPlaces)) return [];
  return [...mapPlaces]
    .map((place, idx) => ({
      place,
      idx,
      hi: isHighlightedPlace(place, highlightedPlaces),
    }))
    .sort((a, b) => {
      if (a.hi !== b.hi) return a.hi ? -1 : 1;
      return a.idx - b.idx;
    })
    .map((d) => d.place);
}
