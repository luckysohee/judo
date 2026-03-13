const CUSTOM_PLACES_KEY = "judo_custom_places";

export function getCustomPlaces() {
  const raw = localStorage.getItem(CUSTOM_PLACES_KEY);

  if (!raw) {
    localStorage.setItem(CUSTOM_PLACES_KEY, JSON.stringify([]));
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.setItem(CUSTOM_PLACES_KEY, JSON.stringify([]));
    return [];
  }
}

export function saveCustomPlaces(places) {
  localStorage.setItem(CUSTOM_PLACES_KEY, JSON.stringify(places));
}

export function addCustomPlace(place) {
  const current = getCustomPlaces();

  const exists = current.some(
    (item) =>
      item.name === place.name &&
      item.lat === place.lat &&
      item.lng === place.lng
  );

  if (exists) {
    throw new Error("이미 추가된 술집입니다.");
  }

  const nextPlace = {
    ...place,
    id: `custom_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const next = [nextPlace, ...current];
  saveCustomPlaces(next);

  return nextPlace;
}