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
    const allowNonUuid = row?.allowNonUuid === true;
    const hasUuid = Boolean(pid && UUID_RE.test(pid));
    if (!hasUuid && !allowNonUuid) continue;
    if (hasUuid) uuidRowCount += 1;
    const lat = parseCoursePreviewCoord(row.place_lat);
    const lng = parseCoursePreviewCoord(row.place_lng);
    if (lat == null || lng == null) {
      if (hasUuid) missingCoordCount += 1;
      continue;
    }
    const key = String(row.key ?? pid ?? `pt-${points.length}`);
    points.push({
      key,
      place_id: hasUuid ? pid : key,
      lat,
      lng,
      order: points.length + 1,
    });
  }

  return {
    points,
    uuidRowCount,
    missingCoordCount,
    showEmptyCourseHint: points.length === 0 && uuidRowCount === 0,
    showMissingCoordHint: uuidRowCount > 0 && missingCoordCount > 0,
  };
}
