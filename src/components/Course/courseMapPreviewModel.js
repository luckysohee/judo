const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 성수 일대 — 좌표 없을 때 기본 뷰 (MapView DEFAULT 와 유사) */
export const COURSE_MAP_PREVIEW_DEFAULT_CENTER = { lat: 37.54465, lng: 127.05595 };

export function parseCoursePreviewCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 코스 에디터 `placeRows` → 지도용 순서 점 목록
 * @param {object[]} placeRows
 * @returns {{
 *   points: { key: string, place_id: string, lat: number, lng: number, order: number }[],
 *   uuidRowCount: number,
 *   missingCoordCount: number,
 *   showEmptyCourseHint: boolean,
 *   showMissingCoordHint: boolean,
 * }}
 */
export function buildCourseMapPreviewModel(placeRows) {
  const rows = Array.isArray(placeRows) ? placeRows : [];
  let uuidRowCount = 0;
  let missingCoordCount = 0;
  const points = [];

  for (const row of rows) {
    const pid = String(row?.place_id ?? "").trim();
    if (!pid || !UUID_RE.test(pid)) continue;
    uuidRowCount += 1;
    const lat = parseCoursePreviewCoord(row.place_lat);
    const lng = parseCoursePreviewCoord(row.place_lng);
    if (lat == null || lng == null) {
      missingCoordCount += 1;
      continue;
    }
    points.push({
      key: String(row.key ?? pid),
      place_id: pid,
      lat,
      lng,
      order: points.length + 1,
    });
  }

  return {
    points,
    uuidRowCount,
    missingCoordCount,
    showEmptyCourseHint: uuidRowCount === 0,
    showMissingCoordHint: uuidRowCount > 0 && missingCoordCount > 0,
  };
}
