import {
  getKakaoPlaceBasicInfoViaProxy,
  searchKakaoKeywordViaProxy,
} from "./kakaoAPIProxy";
import { fetchGooglePlacePhotoThumb } from "./googlePlacePhotoThumb";
import { mapPlaceRowForCourse } from "../api/places";
import { supabase } from "../lib/supabase";
import { rewriteLegacySupabaseStorageUrl } from "./rewriteLegacySupabaseStorageUrl";

export function isResolvableCourseStepThumbUrl(url) {
  const u = rewriteLegacySupabaseStorageUrl(String(url || "").trim());
  return /^https?:\/\//i.test(u);
}

/** 큐레이터가 올린 스텝 사진 URL */
export function pickStepUploadedThumb(step) {
  if (!step || typeof step !== "object") return null;
  const u = rewriteLegacySupabaseStorageUrl(
    String(step.step_image_url || step.image_url || step.thumb_url || "").trim()
  );
  return isResolvableCourseStepThumbUrl(u) ? u : null;
}

async function thumbFromKakaoPlaceId(kakaoId, name, lat, lng) {
  const id = String(kakaoId || "").trim();
  if (!/^\d+$/.test(id)) return null;
  try {
    const info = await getKakaoPlaceBasicInfoViaProxy(id, {
      query: name,
      x: Number.isFinite(lng) ? lng : undefined,
      y: Number.isFinite(lat) ? lat : undefined,
    });
    const thumb = info?.thumbnail_url || info?.photo_urls?.[0];
    return isResolvableCourseStepThumbUrl(thumb) ? thumb : null;
  } catch {
    return null;
  }
}

/** 카카오 id 없거나 썸네일 비었을 때 — 좌표 근처 키워드로 동일 상호 찾기 */
async function thumbFromKakaoKeyword(name, lat, lng) {
  const q = String(name || "").trim();
  if (q.length < 2) return null;
  try {
    const { documents, status } = await searchKakaoKeywordViaProxy({
      query: q.slice(0, 40),
      size: 5,
      x: Number.isFinite(lng) ? lng : undefined,
      y: Number.isFinite(lat) ? lat : undefined,
      radius:
        Number.isFinite(lat) && Number.isFinite(lng) ? 3000 : undefined,
    });
    if (status === 429) return null;
    const docs = Array.isArray(documents) ? documents : [];
    if (docs.length === 0) return null;
    const nameNorm = q.replace(/\s+/g, "");
    const hit =
      docs.find((d) => {
        const pn = String(d.place_name || "").replace(/\s+/g, "");
        return (
          pn === nameNorm ||
          pn.includes(nameNorm) ||
          nameNorm.includes(pn)
        );
      }) || docs[0];
    const kid = String(hit?.id || "").trim();
    if (/^\d+$/.test(kid)) {
      return thumbFromKakaoPlaceId(
        kid,
        hit.place_name || q,
        Number(hit.y),
        Number(hit.x)
      );
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {object} step
 * @param {{ skipGoogleFallback?: boolean }} [opts]
 * @returns {Promise<string|null>}
 */
export async function resolveCourseStepThumbUrl(step, opts = {}) {
  const uploaded = pickStepUploadedThumb(step);
  if (uploaded) return uploaded;

  const rawKakao = String(step?.kakao_place_id || "").trim();
  const kakaoId = /^\d+$/.test(rawKakao) ? rawKakao : "";
  const lat = Number(step?.lat);
  const lng = Number(step?.lng);
  const name = String(step?.name || step?.place_name || "").trim();
  const address = String(step?.address || step?.place_address || "").trim();

  if (kakaoId) {
    const byId = await thumbFromKakaoPlaceId(kakaoId, name, lat, lng);
    if (byId) return byId;
  }

  if (name) {
    const byKeyword = await thumbFromKakaoKeyword(name, lat, lng);
    if (byKeyword) return byKeyword;
  }

  if (opts.skipGoogleFallback) return null;

  if (!name && !(Number.isFinite(lat) && Number.isFinite(lng))) {
    return null;
  }

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

/** 코스 에디터 place row → 카카오 썸네일 조회 입력 */
export function courseCoverInputFromPlaceRow(row) {
  if (!row || typeof row !== "object") return null;
  const placeId = String(row.place_id || row.id || "").trim();
  const name = String(row.place_name || row.name || "").trim();
  const address = String(row.place_address || row.address || "").trim();
  const lat = parseRowCoord(row.place_lat ?? row.lat);
  const lng = parseRowCoord(row.place_lng ?? row.lng);
  const kakaoId = String(row.kakao_place_id || "").trim();
  if (!placeId && !kakaoId && !name) return null;
  return {
    place_id: placeId || null,
    name,
    address,
    lat,
    lng,
    kakao_place_id: kakaoId || null,
  };
}

function parseRowCoord(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 커버 미설정 시 1차 장소 카카오 지도 사진 URL (Google 폴백 없음).
 * @param {object} row
 * @param {{ skipGoogleFallback?: boolean }} [opts]
 * @returns {Promise<string|null>}
 */
export async function resolveCourseCoverFromFirstPlace(row, opts = {}) {
  const input = courseCoverInputFromPlaceRow(row);
  if (!input) return null;
  return resolveCourseStepThumbUrl(input, {
    skipGoogleFallback: true,
    ...opts,
  });
}

/** 코스 객체에서 1차 장소 스텝(목록·상세·조인 등 형태 통합) */
export function firstCoursePlaceStepFromCourse(course) {
  if (!course || typeof course !== "object") return null;
  if (Array.isArray(course.preview_steps) && course.preview_steps.length > 0) {
    return course.preview_steps[0];
  }
  if (Array.isArray(course.thumb_steps) && course.thumb_steps.length > 0) {
    return course.thumb_steps[0];
  }
  if (
    Array.isArray(course.curator_course_places) &&
    course.curator_course_places.length > 0
  ) {
    const sorted = [...course.curator_course_places]
      .filter((s) => s && typeof s === "object")
      .sort((a, b) => Number(a.order_index) - Number(b.order_index));
    if (sorted.length === 0) return null;
    return previewStepFromCoursePlaceRow(sorted[0], 0);
  }
  if (Array.isArray(course.places) && course.places.length > 0) {
    const p = course.places[0];
    return {
      place_id: p.place_id,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      kakao_place_id: p.kakao_place_id,
      step_image_url: p.image_url,
      image_url: p.image_url,
    };
  }
  return null;
}

/**
 * 표시용 커버 URL — 명시 커버 → (옵션) 해석된 1차 썸네일 → 1차 업로드 사진.
 * @param {object|null|undefined} course
 * @param {{ resolvedFirstThumbUrl?: string|null }} [opts]
 */
export function pickCourseDisplayCoverUrl(course, opts = {}) {
  const explicit = rewriteLegacySupabaseStorageUrl(
    String(course?.cover_image_url || "").trim()
  );
  if (explicit) return explicit;
  const resolved = String(opts.resolvedFirstThumbUrl || "").trim();
  if (resolved) return resolved;
  const first = firstCoursePlaceStepFromCourse(course);
  if (!first) return "";
  return pickStepUploadedThumb(first) || "";
}

/** 검색·카운트-only 목록 등 preview_steps 없는 코스에 1차 장소 스텝 부착 */
export async function hydrateCoursesWithFirstPreviewStep(courses) {
  if (!Array.isArray(courses) || courses.length === 0) return courses;

  const needIds = [];
  for (const course of courses) {
    if (String(course?.cover_image_url || "").trim()) continue;
    if (firstCoursePlaceStepFromCourse(course)) continue;
    const id = String(course?.id || "").trim();
    if (id) needIds.push(id);
  }
  if (needIds.length === 0) return courses;

  const uniqueIds = [...new Set(needIds)];
  const { data, error } = await supabase
    .from("curator_course_places")
    .select(
      `course_id, order_index, place_id, image_url,
       places ( name, lat, lng, kakao_place_id, address, category )`
    )
    .in("course_id", uniqueIds)
    .order("order_index", { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) return courses;

  const firstByCourse = new Map();
  for (const row of data) {
    const cid = String(row.course_id || "").trim().toLowerCase();
    if (!cid || firstByCourse.has(cid)) continue;
    const step = previewStepFromCoursePlaceRow(row, 0);
    if (step) firstByCourse.set(cid, step);
  }

  return courses.map((course) => {
    const cid = String(course?.id || "").trim().toLowerCase();
    const step = firstByCourse.get(cid);
    if (!step) return course;
    const existing = Array.isArray(course.preview_steps)
      ? course.preview_steps
      : [];
    if (existing.length > 0) return course;
    return { ...course, preview_steps: [step] };
  });
}

/** 커버 없을 때 1차 장소 카카오 사진 URL 해석 */
export async function resolveCourseCoverForCourse(course) {
  const explicit = String(course?.cover_image_url || "").trim();
  if (explicit) return explicit;
  const first = firstCoursePlaceStepFromCourse(course);
  if (!first) return null;
  const uploaded = pickStepUploadedThumb(first);
  if (uploaded) return uploaded;
  return resolveCourseCoverFromFirstPlace(first);
}

/** 목록 행 — 커ver 없는 코스에 1차 장소 카카오 사진 보강 */
export async function enrichCoursesWithAutoCover(courses) {
  if (!Array.isArray(courses) || courses.length === 0) return courses;
  const hydrated = await hydrateCoursesWithFirstPreviewStep(courses);
  return Promise.all(
    hydrated.map(async (course) => {
      if (String(course?.cover_image_url || "").trim()) return course;
      const url = await resolveCourseCoverForCourse(course);
      return url ? { ...course, cover_image_url: url } : course;
    })
  );
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

/**
 * 지도 핀(2차 찾기 펄스·확정 코스·맛집첩)에 카카오/구글 썸네일 부착
 * @param {object[]} places
 * @param {{ skipGoogleFallback?: boolean }} [opts]
 *   맛집첩 펼침은 사진 원형이 핵심이라 기본 false(구글 폴백 ON) 권장.
 *   코스 펄스 등 대량 호출은 skipGoogleFallback: true.
 */
export async function enrichMapPlacesWithStepThumbs(places = [], opts = {}) {
  if (!Array.isArray(places) || places.length === 0) return places;
  /** 기본 true(코스 대량). 맛집첩만 `{ skipGoogleFallback: false }` */
  const skipGoogleFallback = opts.skipGoogleFallback !== false;

  return Promise.all(
    places.map(async (p) => {
      const existing = pickStepUploadedThumb({
        step_image_url:
          p.courseStepThumbUrl ||
          p.step_image_url ||
          p.image_url ||
          p.image ||
          p.thumbnail_url,
      });
      if (existing) {
        return { ...p, courseStepThumbUrl: existing };
      }

      const kakaoId = String(
        p.kakao_place_id || p.place_id || p.kakaoId || ""
      ).trim();
      const thumb = await resolveCourseStepThumbUrl(
        {
          place_id: p.id,
          name: p.name || p.place_name,
          step_image_url: p.step_image_url || p.image_url || p.image,
          lat: p.lat,
          lng: p.lng,
          address: p.address_name || p.address || "",
          kakao_place_id: /^\d+$/.test(kakaoId) ? kakaoId : null,
        },
        { skipGoogleFallback }
      );

      return thumb ? { ...p, courseStepThumbUrl: thumb } : p;
    })
  );
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
