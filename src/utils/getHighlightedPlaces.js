function normName(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function namePairMatches(a, b) {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

export function getHighlightedPlaces(mapPlaces, recommendation) {
  const recPlaces = recommendation?.places;
  if (!Array.isArray(mapPlaces) || !Array.isArray(recPlaces)) return [];

  return mapPlaces.filter((p) => {
    const name = p?.name;
    if (name == null || name === "") return false;
    return recPlaces.some((r) => namePairMatches(name, r?.name));
  });
}
