/**
 * Server copy of src/utils/kakaoWalkingRoutePath.js (Railway root = server/).
 * Keep in sync with the frontend canonical file when parsing changes.
 */

/**
 * 카카오모빌리티 도보 길찾기 routes[0] → `{ lat, lng }[]`
 * @param {object} route
 */
export function pathFromKakaoWalkingRoute(route) {
  const sections = route?.sections;
  if (!Array.isArray(sections)) return [];

  const path = [];
  const eps = 1e-7;

  for (const section of sections) {
    const roads = section?.roads;
    if (!Array.isArray(roads)) continue;
    for (const road of roads) {
      const vertexes = road?.vertexes;
      if (!Array.isArray(vertexes) || vertexes.length < 4) continue;
      for (let i = 0; i + 1 < vertexes.length; i += 2) {
        const lng = Number(vertexes[i]);
        const lat = Number(vertexes[i + 1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const last = path[path.length - 1];
        if (
          last &&
          Math.abs(last.lat - lat) < eps &&
          Math.abs(last.lng - lng) < eps
        ) {
          continue;
        }
        path.push({ lat, lng });
      }
    }
  }

  return path;
}
