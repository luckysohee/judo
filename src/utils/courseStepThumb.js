import { getKakaoPlaceBasicInfoViaProxy } from "./kakaoAPIProxy";
import { fetchGooglePlacePhotoThumb } from "./googlePlacePhotoThumb";
import { mapPlaceRowForCourse } from "../api/places";

export function isResolvableCourseStepThumbUrl(url) {
  const u = String(url || "").trim();
  return /^https?:\/\//i.test(u);
}

/** 큐레이터가 올린 스텝 사진 URL */
export function pickStepUploadedThumb(step) {
  if (!step || typeof step !== "object") return null;
  const u = String(
    step.step_image_url || step.image_url || step.thumb_url || ""
  ).trim();
  return isResolvableCourseStepThumbUrl(u) ? u : null;
}

/**
 * @param {object} step
 * @param {{ skipGoogleFallback?: boolean }} [opts]
 * @returns {Promise<string|null>}
 */
export async function resolveCourseStepThumbUrl(step, opts = {}) {
  const uploaded = pickStepUploadedThumb(step);
  if (uploaded) return uploaded;

  const kakaoId = String(step?.kakao_place_id || "").trim();
  if (!kakaoId) return null;

  const lat = Number(step?.lat);
  const lng = Number(step?.lng);
  const name = String(step?.name || "").trim();
  const address = String(step?.address || "").trim();

  if (kakaoId) {
    try {
      const info = await getKakaoPlaceBasicInfoViaProxy(kakaoId, {
        query: name,
        x: Number.isFinite(lng) ? lng : undefined,
        y: Number.isFinite(lat) ? lat : undefined,
      });
      const thumb = info?.thumbnail_url || info?.photo_urls?.[0];
      if (isResolvableCourseStepThumbUrl(thumb)) return thumb;
    } catch {
      /* fall through */
    }
  }

  if (opts.skipGoogleFallback) return null;

  const googleThumb = await fetchGooglePlacePhotoThumb({
    name,
    address,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  });
  return isResolvableCourseStepThumbUrl(googleThumb) ? googleThumb : null;
}

/**
 * @param {object[]} steps
 * @param {{ limit?: number, skipGoogleFallback?: boolean }} [opts]
 * @returns {Promise<Record<string, string>>}
 */
export async function resolveCourseStepThumbMap(steps, opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(6, Math.floor(opts.limit))
      : 3;
  const list = Array.isArray(steps) ? steps.slice(0, limit) : [];
  const out = /** @type {Record<string, string>} */ ({});

  await Promise.all(
    list.map(async (step, i) => {
      const key = stepThumbKey(step, i);
      const url = await resolveCourseStepThumbUrl(step, {
        skipGoogleFallback: opts.skipGoogleFallback,
      });
      if (url) out[key] = url;
    })
  );

  return out;
}

export function stepThumbKey(step, index = 0) {
  const pid = String(step?.place_id || "").trim();
  if (pid) return pid;
  const order = Number(step?.order);
  if (Number.isFinite(order) && order > 0) return `order-${order}`;
  return `idx-${index}`;
}

/** `curator_course_places` 행 → 홈 코스 카드·썸네일용 스텝 */
export function previewStepFromCoursePlaceRow(s, index) {
  if (!s || typeof s !== "object") return null;
  const pl = s.places && typeof s.places === "object" ? s.places : {};
  const meta = mapPlaceRowForCourse({ id: s.place_id, ...pl });
  const order = index + 1;
  return {
    order,
    label: `${order}차`,
    place_id: s.place_id,
    name: meta.name,
    category: meta.category,
    step_image_url: s.image_url || null,
    lat: meta.lat,
    lng: meta.lng,
    address: meta.address,
    kakao_place_id: pl.kakao_place_id || meta.kakao_place_id || null,
  };
}

/**
 * 지도 드라이브 스텝에 썸네일 URL 부착
 * @param {{ steps?: object[] } | null} drive
 */
export async function enrichDrivingMapWithStepThumbs(drive) {
  if (!drive || !Array.isArray(drive.steps) || drive.steps.length === 0) {
    return drive;
  }

  const thumbInputs = drive.steps.map((st, i) => {
    const p = st?.place && typeof st.place === "object" ? st.place : {};
    return {
      place_id: p.id,
      order: st.step,
      label: st.label,
      name: p.name || p.place_name,
      step_image_url: p.step_image_url || p.image_url,
      lat: p.lat,
      lng: p.lng,
      address: p.address_name || p.address || "",
      kakao_place_id: p.kakao_place_id,
      _index: i,
    };
  });

  const thumbMap = await resolveCourseStepThumbMap(thumbInputs, {
    limit: thumbInputs.length,
    skipGoogleFallback: true,
  });

  const steps = drive.steps.map((st, i) => {
    const p = st?.place && typeof st.place === "object" ? st.place : {};
    const key = stepThumbKey(thumbInputs[i], i);
    const thumb = thumbMap[key] || pickStepUploadedThumb(thumbInputs[i]);
    if (!thumb) return st;
    return {
      ...st,
      place: {
        ...p,
        courseStepThumbUrl: thumb,
      },
    };
  });

  return { ...drive, steps };
}

/** 지도 드라이브 → 바텀시트·썸네일 스트립 입력 */
export function sheetStepsFromDrivingMap(drive) {
  if (!drive || !Array.isArray(drive.steps)) return [];
  return drive.steps.map((st) => {
    const p = st?.place && typeof st.place === "object" ? st.place : {};
    return {
      order: st.step,
      label: st.label,
      place_id: p.id,
      name: p.name || p.place_name,
      category: p.category_name || "",
      address: p.address_name || "",
      memo: st.memo || "",
      stay_minutes: st.stay_minutes ?? null,
      step_image_url: p.courseStepThumbUrl || p.step_image_url || p.image_url,
      kakao_place_id: p.kakao_place_id,
      lat: p.lat,
      lng: p.lng,
    };
  });
}

/** 지도 드라이브 → `CourseStepThumbStrip` 입력 */
export function thumbStripStepsFromDrivingMap(drive) {
  if (!drive || !Array.isArray(drive.steps)) return [];
  return drive.steps.map((st) => {
    const p = st?.place && typeof st.place === "object" ? st.place : {};
    return {
      order: st.step,
      label: st.label,
      place_id: p.id,
      name: p.name || p.place_name,
      step_image_url: p.courseStepThumbUrl || p.step_image_url || p.image_url,
      kakao_place_id: p.kakao_place_id,
      lat: p.lat,
      lng: p.lng,
    };
  });
}
