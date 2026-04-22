function normName(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

export function nameMatches(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function isHighlightedPlace(place, highlightedPlaces) {
  return (
    !!place &&
    Array.isArray(highlightedPlaces) &&
    highlightedPlaces.length > 0 &&
    highlightedPlaces.some((h) => nameMatches(place.name, h?.name))
  );
}
