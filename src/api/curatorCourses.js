import { supabase } from "./client";
import { mapPlaceRowForCourse } from "./places.js";
import { previewStepFromCoursePlaceRow, pickCourseDisplayCoverUrl } from "../utils/courseStepThumb.js";
import { isImportedCuratorCourse } from "../utils/courseImportUi.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id, label) {
  const s = String(id ?? "").trim();
  if (!s || !UUID_RE.test(s)) {
    throw new Error(`${label}: invalid uuid`);
  }
  return s;
}

function throwIfSupabaseError(error, koLabel) {
  if (!error) return;
  console.error(koLabel, error);
  throw error;
}

async function assertCourseEditable(courseId, label) {
  const { data, error } = await supabase
    .from("curator_courses")
    .select("imported_from_course_id")
    .eq("id", courseId)
    .maybeSingle();
  throwIfSupabaseError(error, label);
  if (isImportedCuratorCourse(data)) {
    const err = new Error("스크랩한 코스는 수정하거나 공개할 수 없습니다.");
    console.error(label, err);
    throw err;
  }
}

function normalizePlaceCountRow(row) {
  if (!row || typeof row !== "object") return { ...row, place_count: 0 };
  const nested = row.curator_course_places;
  let place_count = 0;
  if (Array.isArray(nested) && nested.length > 0) {
    const n = nested[0]?.count;
    place_count = n != null ? Number(n) || 0 : 0;
  }
  const { curator_course_places: _omit, ...rest } = row;
  return { ...rest, place_count };
}

/** 공개 코스 목록: 스텝 배열 + 상위 3곳 라벨(이름·카테고리). */
function normalizePublicCuratorCoursesRow(row) {
  if (!row || typeof row !== "object") {
    return { ...row, place_count: 0, preview_steps: [] };
  }
  const nested = row.curator_course_places;
  const { curator_course_places: _omit, ...rest } = row;
  if (!Array.isArray(nested) || nested.length === 0) {
    return { ...rest, place_count: 0, preview_steps: [] };
  }
  if (nested.length === 1 && nested[0] != null && "count" in nested[0]) {
    const n = nested[0]?.count;
    const place_count = n != null ? Number(n) || 0 : 0;
    return { ...rest, place_count, preview_steps: [] };
  }
  const steps = [...nested]
    .filter((s) => s && typeof s === "object")
    .sort((a, b) => Number(a.order_index) - Number(b.order_index));
  const place_count = steps.length;
  const preview_steps = steps.slice(0, 3).map((s, i) => previewStepFromCoursePlaceRow(s, i)).filter(Boolean);
  const cover_image_url = pickCourseDisplayCoverUrl({
    ...rest,
    preview_steps,
  });
  return { ...rest, cover_image_url, place_count, preview_steps };
}

/**
 * @typedef {object} CuratorCoursePayload
 * @property {string} curator_id
 * @property {string} title
 * @property {string} [description]
 * @property {string} [area]
 * @property {string[]} [theme_tags]
 * @property {string} [cover_image_url]
 * @property {'draft'|'published'|'private'} [status]
 * @property {boolean} [is_public]
 */

/**
 * @typedef {object} CuratorCoursePlaceInput
 * @property {string} place_id
 * @property {number} order_index
 * @property {string} [memo]
 * @property {string} [image_url]
 * @property {number|null} [stay_minutes]
 */

/**
 * @param {CuratorCoursePayload} payload
 * @returns {Promise<object>}
 */
export async function createCuratorCourse(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const curator_id = assertUuid(p.curator_id, "createCuratorCourse.curator_id");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id || user.id !== curator_id) {
    const err = new Error(
      "createCuratorCourse: curator_id must match the signed-in user"
    );
    console.error("[코스 생성 실패]", err);
    throw err;
  }

  const titleTrim = String(p.title ?? "").trim();
  if (!titleTrim) {
    const err = new Error("createCuratorCourse: title is required");
    console.error("[코스 생성 실패]", err);
    throw err;
  }

  if (p.imported_from_course_id != null) {
    const err = new Error(
      "createCuratorCourse: imported_from_course_id is not allowed from client"
    );
    console.error("[코스 생성 실패]", err);
    throw err;
  }

  const row = {
    curator_id,
    title: titleTrim,
    description: p.description ?? null,
    area: p.area ?? null,
    theme_tags: Array.isArray(p.theme_tags) ? p.theme_tags : [],
    cover_image_url: p.cover_image_url ?? null,
    status: p.status ?? "draft",
    is_public: p.is_public ?? false,
  };

  const { data, error } = await supabase
    .from("curator_courses")
    .insert(row)
    .select()
    .single();
  throwIfSupabaseError(error, "[코스 생성 실패]");
  return data;
}

/**
 * @param {string} courseId
 * @param {Partial<Omit<CuratorCoursePayload, 'curator_id'>>} payload
 * @returns {Promise<object>}
 */
export async function updateCuratorCourse(courseId, payload) {
  const id = assertUuid(courseId, "updateCuratorCourse.courseId");
  await assertCourseEditable(id, "[코스 수정 실패]");
  const p = payload && typeof payload === "object" ? payload : {};
  const patch = {};
  if ("title" in p) {
    const t = String(p.title ?? "").trim();
    if (!t) {
      const err = new Error("updateCuratorCourse: title cannot be empty");
      console.error("[코스 수정 실패]", err);
      throw err;
    }
    patch.title = t;
  }
  if ("description" in p) patch.description = p.description;
  if ("area" in p) patch.area = p.area;
  if ("theme_tags" in p)
    patch.theme_tags = Array.isArray(p.theme_tags) ? p.theme_tags : [];
  if ("cover_image_url" in p) patch.cover_image_url = p.cover_image_url;
  if ("status" in p) patch.status = p.status;
  if ("is_public" in p) patch.is_public = p.is_public;

  if (Object.keys(patch).length === 0) {
    const { data, error } = await supabase
      .from("curator_courses")
      .select()
      .eq("id", id)
      .single();
    throwIfSupabaseError(error, "[코스 수정 실패]");
    return data;
  }

  const { data, error } = await supabase
    .from("curator_courses")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  throwIfSupabaseError(error, "[코스 수정 실패]");
  return data;
}

/**
 * @param {string} courseId
 * @returns {Promise<void>}
 */
export async function deleteCuratorCourse(courseId) {
  const id = assertUuid(courseId, "deleteCuratorCourse.courseId");
  const { data: row, error: selErr } = await supabase
    .from("curator_courses")
    .select("imported_from_course_id")
    .eq("id", id)
    .maybeSingle();
  throwIfSupabaseError(selErr, "[코스 삭제 실패]");
  if (isImportedCuratorCourse(row)) {
    const err = new Error(
      "스크랩한 코스는 removeImportedCuratorCourse로 삭제하세요."
    );
    console.error("[코스 삭제 실패]", err);
    throw err;
  }
  const { error } = await supabase.from("curator_courses").delete().eq("id", id);
  throwIfSupabaseError(error, "[코스 삭제 실패]");
}

/**
 * 코스 1건 + 스텝 + places 조인. order_index 오름차순.
 * @param {string} courseId
 * @returns {Promise<object|null>}
 */
export async function fetchCuratorCourseById(courseId) {
  const id = assertUuid(courseId, "fetchCuratorCourseById.courseId");
  const { data, error } = await supabase
    .from("curator_courses")
    .select(
      `
      *,
      curator_course_places (
        id,
        course_id,
        place_id,
        order_index,
        memo,
        image_url,
        stay_minutes,
        created_at,
        places (*)
      )
    `
    )
    .eq("id", id)
    .order("order_index", {
      ascending: true,
      foreignTable: "curator_course_places",
    })
    .maybeSingle();
  throwIfSupabaseError(error, "[코스 단건 조회 실패]");
  if (!data) return null;
  const steps = Array.isArray(data.curator_course_places)
    ? [...data.curator_course_places].sort(
        (a, b) => Number(a.order_index) - Number(b.order_index)
      )
    : [];
  return { ...data, curator_course_places: steps };
}

/** 홈 코스 탭·지도 미리보기 — `places (*)` 없이 필요한 컬럼만 */
export async function fetchCuratorCourseForHomePreview(courseId) {
  const id = assertUuid(courseId, "fetchCuratorCourseForHomePreview.courseId");
  const { data, error } = await supabase
    .from("curator_courses")
    .select(
      `
      id,
      title,
      description,
      cover_image_url,
      area,
      theme_tags,
      curator_id,
      created_at,
      status,
      is_public,
      imported_from_course_id,
      curator_course_places (
        id,
        course_id,
        place_id,
        order_index,
        memo,
        image_url,
        stay_minutes,
        places (
          id,
          name,
          lat,
          lng,
          kakao_place_id,
          address,
          category
        )
      )
    `
    )
    .eq("id", id)
    .order("order_index", {
      ascending: true,
      foreignTable: "curator_course_places",
    })
    .maybeSingle();
  throwIfSupabaseError(error, "[코스 홈 미리보기 조회 실패]");
  if (!data) return null;
  const steps = Array.isArray(data.curator_course_places)
    ? [...data.curator_course_places].sort(
        (a, b) => Number(a.order_index) - Number(b.order_index)
      )
    : [];
  return { ...data, curator_course_places: steps };
}

/**
 * @param {{
 *   area?: string,
 *   theme_tags?: string|string[],
 *   curator_id?: string,
 *   limit?: number
 * }} [filters]
 * @returns {Promise<object[]>}
 */
export async function fetchPublicCuratorCourses(filters = {}) {
  const limit =
    typeof filters.limit === "number" && filters.limit > 0
      ? Math.min(100, Math.floor(filters.limit))
      : 20;

  const applyFilters = (q) => {
    let next = q;
    if (filters.area != null && String(filters.area).trim()) {
      next = next.eq("area", String(filters.area).trim());
    }
    if (filters.curator_id != null && String(filters.curator_id).trim()) {
      next = next.eq(
        "curator_id",
        assertUuid(filters.curator_id, "filters.curator_id")
      );
    }
    if (filters.theme_tags != null) {
      const tags = Array.isArray(filters.theme_tags)
        ? filters.theme_tags
        : [filters.theme_tags];
      const cleaned = tags.map((t) => String(t).trim()).filter(Boolean);
      if (cleaned.length) {
        next = next.overlaps("theme_tags", cleaned);
      }
    }
    return next;
  };

  const selects = [
    `*,
      curator_course_places (
        order_index,
        place_id,
        image_url,
        places (
          name,
          category,
          lat,
          lng,
          kakao_place_id
        )
      )`,
    `*,
      curator_course_places (
        order_index,
        place_id
      )`,
    "id, curator_id, title, description, cover_image_url, area, theme_tags, status, is_public, created_at, updated_at",
  ];

  let lastError = null;
  for (let i = 0; i < selects.length; i += 1) {
    const select = selects[i];
    let q = applyFilters(
      supabase
        .from("curator_courses")
        .select(select)
        .eq("status", "published")
        .eq("is_public", true)
    );
    if (select.includes("curator_course_places")) {
      q = q
        .order("order_index", {
          ascending: true,
          foreignTable: "curator_course_places",
        })
        .order("created_at", { ascending: false })
        .limit(limit);
    } else {
      q = q.order("created_at", { ascending: false }).limit(limit);
    }

    const { data, error } = await q;
    if (!error) {
      return (data || []).map(normalizePublicCuratorCoursesRow);
    }
    lastError = error;
    console.warn(
      `[fetchPublicCuratorCourses] select fallback ${i + 1}/${selects.length}:`,
      error.message || error
    );
  }

  throwIfSupabaseError(lastError, "[공개 코스 목록 조회 실패]");
  return [];
}

/**
 * @param {string} curatorId — 반드시 `auth.uid()` 와 동일해야 RLS 통과
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function fetchMyCuratorCourses(curatorId, opts = {}) {
  const cid = assertUuid(curatorId, "fetchMyCuratorCourses.curatorId");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id || user.id !== cid) {
    const err = new Error(
      "fetchMyCuratorCourses: curatorId must match the signed-in user"
    );
    console.error("[내 코스 목록 조회 실패]", err);
    throw err;
  }
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(200, Math.floor(opts.limit))
      : 100;

  const { data, error } = await supabase
    .from("curator_courses")
    .select(
      `*,
      curator_course_places (
        order_index,
        place_id,
        image_url,
        places (
          name,
          lat,
          lng,
          kakao_place_id,
          address,
          category
        )
      )`
    )
    .eq("curator_id", cid)
    .order("created_at", { ascending: false })
    .order("order_index", {
      ascending: true,
      foreignTable: "curator_course_places",
    })
    .limit(limit);
  throwIfSupabaseError(error, "[내 코스 목록 조회 실패]");
  return (data || []).map((row) => {
    const nested = row.curator_course_places;
    if (Array.isArray(nested) && nested.length > 0 && "count" in (nested[0] || {})) {
      return normalizePlaceCountRow(row);
    }
    return normalizePublicCuratorCoursesRow(row);
  });
}

/**
 * 기존 스텝 전부 삭제 후 재삽입. 1~6개만 허용 (공개는 `publishCuratorCourse`에서 2개 이상).
 * @param {string} courseId
 * @param {CuratorCoursePlaceInput[]} places
 * @returns {Promise<object[]>} 삽입된 행들
 */
export async function saveCuratorCoursePlaces(courseId, places) {
  const cid = assertUuid(courseId, "saveCuratorCoursePlaces.courseId");
  await assertCourseEditable(cid, "[코스 장소 저장 실패]");
  const list = Array.isArray(places) ? places : [];
  if (list.length < 1 || list.length > 6) {
    const err = new Error(
      "saveCuratorCoursePlaces: 장소는 1개 이상 6개 이하여야 합니다."
    );
    console.error("[코스 장소 저장 실패]", err);
    throw err;
  }

  const rows = list.map((raw, i) => {
    const place_id = assertUuid(raw.place_id, `places[${i}].place_id`);
    const order_index =
      typeof raw.order_index === "number" && Number.isFinite(raw.order_index)
        ? Math.floor(raw.order_index)
        : i;
    if (order_index < 0) {
      const err = new Error(
        `saveCuratorCoursePlaces: order_index must be >= 0 (index ${i})`
      );
      console.error("[코스 장소 저장 실패]", err);
      throw err;
    }
    return {
      course_id: cid,
      place_id,
      order_index,
      memo: raw.memo ?? null,
      image_url: raw.image_url ?? null,
      stay_minutes:
        raw.stay_minutes == null
          ? null
          : Math.max(0, Math.floor(Number(raw.stay_minutes))),
    };
  });

  const seenPlace = new Set();
  for (const r of rows) {
    if (seenPlace.has(r.place_id)) {
      const err = new Error(
        "saveCuratorCoursePlaces: 동일 place_id 가 두 번 이상입니다."
      );
      console.error("[코스 장소 저장 실패]", err);
      throw err;
    }
    seenPlace.add(r.place_id);
  }

  const { error: delErr } = await supabase
    .from("curator_course_places")
    .delete()
    .eq("course_id", cid);
  throwIfSupabaseError(delErr, "[코스 장소 저장 실패: 기존 삭제]");

  const { data, error } = await supabase
    .from("curator_course_places")
    .insert(rows)
    .select();
  throwIfSupabaseError(error, "[코스 장소 저장 실패: 삽입]");
  return Array.isArray(data) ? data : [];
}

/**
 * 스텝 2개 미만이면 에러. 충족 시 published + 공개.
 * @param {string} courseId
 * @returns {Promise<object>}
 */
export async function publishCuratorCourse(courseId) {
  const id = assertUuid(courseId, "publishCuratorCourse.courseId");
  await assertCourseEditable(id, "[코스 공개 실패]");

  const { count, error: cErr } = await supabase
    .from("curator_course_places")
    .select("id", { count: "exact", head: true })
    .eq("course_id", id);
  throwIfSupabaseError(cErr, "[코스 공개 실패: 스텝 수 조회]");

  const n = typeof count === "number" ? count : 0;
  if (n < 2) {
    const err = new Error("코스는 최소 2개 이상의 장소가 필요합니다.");
    console.error("[코스 공개 실패]", err);
    throw err;
  }

  const { data, error } = await supabase
    .from("curator_courses")
    .update({ status: "published", is_public: true })
    .eq("id", id)
    .select()
    .single();
  throwIfSupabaseError(error, "[코스 공개 실패]");
  return data;
}

/**
 * 공개 코스 → 내 계정의 draft 복사본 (스텝 동일 순서).
 * @param {string} courseId
 * @returns {Promise<string>} 새 course id
 */
export async function duplicateCuratorCourseToMine(courseId) {
  const id = assertUuid(courseId, "duplicateCuratorCourseToMine.courseId");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user?.id) {
    const err = new Error("duplicateCuratorCourseToMine: not authenticated");
    console.error("[코스 복제 실패]", err);
    throw err;
  }

  const src = await fetchCuratorCourseById(id);
  if (!src) {
    const err = new Error("duplicateCuratorCourseToMine: course not found");
    console.error("[코스 복제 실패]", err);
    throw err;
  }
  if (!(src.status === "published" && src.is_public)) {
    const err = new Error(
      "duplicateCuratorCourseToMine: only published public courses can be duplicated"
    );
    console.error("[코스 복제 실패]", err);
    throw err;
  }

  const baseTitle = String(src.title ?? "").trim() || "제목 없음";
  const newTitle = `[복사] ${baseTitle}`;

  const { data: created, error: insErr } = await supabase
    .from("curator_courses")
    .insert({
      curator_id: user.id,
      title: newTitle,
      description: src.description ?? null,
      area: src.area ?? null,
      theme_tags: Array.isArray(src.theme_tags) ? src.theme_tags : [],
      cover_image_url: src.cover_image_url ?? null,
      status: "draft",
      is_public: false,
    })
    .select("id")
    .single();
  throwIfSupabaseError(insErr, "[코스 복제 실패: 코스 생성]");
  const newId = created?.id;
  if (!newId) {
    const err = new Error("duplicateCuratorCourseToMine: missing new id");
    console.error("[코스 복제 실패]", err);
    throw err;
  }

  const steps = Array.isArray(src.curator_course_places)
    ? src.curator_course_places
    : [];
  if (steps.length === 0) {
    const err = new Error("duplicateCuratorCourseToMine: source has no places");
    console.error("[코스 복제 실패]", err);
    throw err;
  }

  const placeRows = steps
    .slice()
    .sort((a, b) => Number(a.order_index) - Number(b.order_index))
    .map((s) => ({
      place_id: s.place_id,
      order_index: Number(s.order_index) || 0,
      memo: s.memo ?? null,
      image_url: s.image_url ?? null,
      stay_minutes:
        s.stay_minutes == null
          ? null
          : Math.max(0, Math.floor(Number(s.stay_minutes))),
    }));

  await saveCuratorCoursePlaces(newId, placeRows);
  return newId;
}

/*
  사용 예시 (브라우저 콘솔·컴포넌트 effect 등에서):

  import {
    createCuratorCourse,
    saveCuratorCoursePlaces,
    publishCuratorCourse,
    fetchPublicCuratorCourses,
  } from "./api/curatorCourses";

  const course = await createCuratorCourse({
    curator_id: (await supabase.auth.getUser()).data.user.id,
    title: "합정 퇴근 코스",
    area: "합정",
    theme_tags: ["회식"],
  });
  await saveCuratorCoursePlaces(course.id, [
    { place_id: PLACE_UUID_1, order_index: 0, memo: "삼겹" },
    { place_id: PLACE_UUID_2, order_index: 1 },
  ]);
  await publishCuratorCourse(course.id);

  동시성·토큰 단일화가 필요하면 나중에 RPC `publish_curator_course(p_course_id uuid)` 로
  COUNT+UPDATE 를 한 트랜잭션에서 처리하는 마이그레이션을 추가하는 것을 권장.
*/
