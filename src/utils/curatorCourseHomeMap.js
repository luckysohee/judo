import { mapPlaceRowForCourse } from "../api/places";

/**
 * `fetchCuratorCourseById` 결과 → 홈 지도 `courseOptionsToMapPlaces` / `buildCourseMapData` 호환 형태.
 * @param {object|null|undefined} course
 * @returns {{ key: string, courseId: string, title: string, steps: object[] } | null}
 */
export function curatorCourseRowToDrivingMap(course) {
  if (!course || typeof course !== "object") return null;
  const courseId = String(course.id || "").trim();
  if (!courseId) return null;

  const raw = course.curator_course_places;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const sorted = [...raw].sort(
    (a, b) => Number(a.order_index) - Number(b.order_index)
  );
  const steps = [];

  for (const s of sorted) {
    const pl = s.places && typeof s.places === "object" ? s.places : {};
    const meta = mapPlaceRowForCourse({ id: s.place_id, ...pl });
    if (meta.lat == null || meta.lng == null) continue;
    const stepNum = steps.length + 1;
    const sm = s.stay_minutes;
    const stay =
      sm != null && sm !== "" && Number.isFinite(Number(sm))
        ? Math.max(0, Math.floor(Number(sm)))
        : null;
    steps.push({
      step: stepNum,
      label: `${stepNum}차`,
      memo: s.memo != null ? String(s.memo).trim() : "",
      stay_minutes: stay,
      place: {
        id: meta.id || String(s.place_id || "").trim(),
        name: meta.name,
        place_name: meta.name,
        address_name: meta.address,
        category_name: meta.category,
        lat: meta.lat,
        lng: meta.lng,
        step_image_url: s.image_url || null,
        kakao_place_id: pl.kakao_place_id || meta.kakao_place_id || null,
      },
    });
  }

  if (steps.length < 2) return null;

  return {
    key: `public-${courseId}`,
    courseId,
    title: String(course.title || "").trim() || "코스",
    description: String(course.description || "").trim(),
    steps,
  };
}
