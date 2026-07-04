import { mapPlaceRowForCourse } from "../api/places";
import {
  pickStepUploadedThumb,
  previewStepFromCoursePlaceRow,
  resolveCourseStepThumbMap,
  stepThumbKey,
} from "./courseStepThumb";

/**
 * `fetchCuratorCourseById` 행 → 시트 상세 UI용 정규화
 * @param {object|null|undefined} row
 */
export function normalizeHomeCourseBrowseDetail(row) {
  if (!row || typeof row !== "object") return null;
  const courseId = String(row.id || "").trim();
  if (!courseId) return null;

  const raw = row.curator_course_places;
  const places = [];
  const thumb_steps = [];
  if (Array.isArray(raw) && raw.length > 0 && !("count" in (raw[0] || {}))) {
    const sorted = [...raw].sort(
      (a, b) => Number(a.order_index) - Number(b.order_index)
    );
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const pl = s.places && typeof s.places === "object" ? s.places : {};
      const meta = mapPlaceRowForCourse({ id: s.place_id, ...pl });
      const sm = s.stay_minutes;
      const stay =
        sm != null && sm !== "" && Number.isFinite(Number(sm))
          ? Math.max(0, Math.floor(Number(sm)))
          : null;
      const stepNum = i + 1;
      places.push({
        order_index: Number(s.order_index) ?? stepNum - 1,
        place_id: String(s.place_id || meta.id || "").trim(),
        name: meta.name || "이름 없음",
        address: meta.address || "",
        category: meta.category || "",
        memo: s.memo != null ? String(s.memo).trim() : "",
        stay_minutes: stay,
        image_url: s.image_url || null,
        step_label: `${stepNum}차`,
      });
      const thumb = previewStepFromCoursePlaceRow(s, i);
      if (thumb) thumb_steps.push(thumb);
    }
  }

  return {
    courseId,
    title: String(row.title || "").trim() || "제목 없음",
    description: String(row.description || "").trim(),
    cover_image_url: String(row.cover_image_url || "").trim(),
    area: String(row.area || "").trim(),
    theme_tags: Array.isArray(row.theme_tags)
      ? row.theme_tags.map((t) => String(t).trim()).filter(Boolean)
      : [],
    curator_id: String(row.curator_id || "").trim(),
    status: String(row.status || "").trim(),
    is_public: Boolean(row.is_public),
    imported_from_course_id:
      row.imported_from_course_id != null
        ? String(row.imported_from_course_id).trim()
        : "",
    place_count: places.length,
    places,
    thumb_steps,
  };
}

/**
 * 미리보기 — 장소별 구글·카카오 썸네일 선조회(스트립·루트 목록용)
 * @param {object|null} detail
 * @returns {Promise<object|null>}
 */
export async function enrichBrowseDetailWithStepThumbs(detail) {
  if (!detail || !Array.isArray(detail.thumb_steps) || !detail.thumb_steps.length) {
    return detail;
  }
  const steps = detail.thumb_steps;
  const thumbMap = await resolveCourseStepThumbMap(steps, {
    limit: steps.length,
    skipGoogleFallback: true,
  });

  const thumb_steps = steps.map((s, i) => {
    const key = stepThumbKey(s, i);
    const url = thumbMap[key] || pickStepUploadedThumb(s);
    if (!url) return s;
    return {
      ...s,
      image_url: url,
      step_image_url: url,
      thumb_url: url,
    };
  });

  const places = (Array.isArray(detail.places) ? detail.places : []).map(
    (p, i) => {
      const url =
        thumbMap[stepThumbKey(thumb_steps[i], i)] ||
        thumb_steps[i]?.image_url ||
        thumb_steps[i]?.step_image_url;
      return url ? { ...p, image_url: url } : p;
    }
  );

  return { ...detail, thumb_steps, places };
}
