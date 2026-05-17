import { supabase } from "../lib/supabase";
import {
  createCuratorCourse,
  saveCuratorCoursePlaces,
} from "../api/curatorCourses";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickUuid(...candidates) {
  for (const c of candidates) {
    const s = c == null ? "" : String(c).trim();
    if (s && UUID_RE.test(s)) return s.toLowerCase();
  }
  return null;
}

/**
 * `curator_course_places.place_id`용 — `places.id` UUID만 허용.
 * @param {object|null|undefined} place — 코스 스텝의 `place` (또는 `_raw`)
 * @returns {string|null}
 */
export function extractDbPlaceUuidFromCourseStepPlace(place) {
  if (!place || typeof place !== "object") return null;
  const raw = place._raw && typeof place._raw === "object" ? place._raw : null;
  return pickUuid(place.id, place.place_id, raw?.id, raw?.place_id);
}

function stepMemoFromRecommendedStep(step, course) {
  const bits = [];
  if (step?.reason != null) bits.push(String(step.reason).trim());
  if (step?.description != null) bits.push(String(step.description).trim());
  const joined = bits.filter(Boolean).join(" · ");
  if (joined) return joined.slice(0, 500);
  const label = String(step?.label || "").trim();
  const nm = String(step?.place?.name || step?.place?.place_name || "").trim();
  if (label && nm) return `${label}: ${nm}`.slice(0, 240);
  if (course?.profileDescription) {
    const d = String(course.profileDescription).trim();
    if (d) return d.slice(0, 240);
  }
  return null;
}

function stayMinutesFromStep(step) {
  const sm = step?.stayMinutes;
  if (sm == null || sm === "") return null;
  if (!Number.isFinite(Number(sm))) return null;
  return Math.max(0, Math.floor(Number(sm)));
}

/**
 * @param {object} course — `generateCourseOptions` 항목
 * @param {object|null} courseQueryParsed — `parseCourseQuery` 결과
 * @param {string} rawSearchQuery
 * @returns {{ placeRows: { place_id: string, order_index: number, memo: string|null, stay_minutes: number|null }[], skippedSteps: number, rawStepCount: number }}
 */
export function buildCuratorPlaceRowsFromRecommendedCourse(
  course,
  courseQueryParsed,
  rawSearchQuery
) {
  const c = course && typeof course === "object" ? course : {};
  const steps = Array.isArray(c.steps) ? c.steps : [];
  const placeRows = [];
  let skippedSteps = 0;
  let oi = 0;
  for (const step of steps) {
    const place = step?.place;
    const pid = extractDbPlaceUuidFromCourseStepPlace(place);
    if (!pid) {
      if (place) skippedSteps += 1;
      continue;
    }
    const memo = stepMemoFromRecommendedStep(step, c);
    const stay = stayMinutesFromStep(step);
    placeRows.push({
      place_id: pid,
      order_index: oi,
      memo: memo || null,
      stay_minutes: stay,
    });
    oi += 1;
  }
  return {
    placeRows,
    skippedSteps,
    rawStepCount: steps.length,
  };
}

/**
 * @param {object} course
 * @param {object|null} courseQueryParsed
 * @param {string} rawSearchQuery
 */
export function buildDraftCoursePayloadFromRecommended(
  course,
  courseQueryParsed,
  rawSearchQuery
) {
  const c = course && typeof course === "object" ? course : {};
  const pq =
    courseQueryParsed && typeof courseQueryParsed === "object"
      ? courseQueryParsed
      : {};
  const q = String(rawSearchQuery || "").replace(/\s+/g, " ").trim();

  const titleFromProfile = String(c.profileTitle || "").trim();
  const firstName = String(
    c.steps?.[0]?.place?.name || c.steps?.[0]?.place?.place_name || ""
  ).trim();
  const title =
    titleFromProfile ||
    (firstName ? `${firstName} · 추천 루트` : "") ||
    "나만의 코스";

  const descFromProfile = String(c.profileDescription || "").trim();
  const description =
    descFromProfile || "홈 추천에서 저장한 코스";

  const area =
    (pq.area != null && String(pq.area).trim()) ||
    String(c.steps?.[0]?.place?.areaName || "").trim() ||
    null;

  const theme_tags = [];
  const pk = String(c.profileKey || "").trim();
  if (pk) theme_tags.push(pk);
  const mode = String(pq.mode || pq.dateMode || "").trim();
  if (mode && !theme_tags.includes(mode)) theme_tags.push(mode);
  if (q) {
    const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
    for (const w of words) {
      const t = w.replace(/[^\uAC00-\uD7A3a-z0-9]/gi, "");
      if (t.length >= 2 && t.length <= 16 && !theme_tags.includes(t)) {
        theme_tags.push(t);
      }
      if (theme_tags.length >= 8) break;
    }
  }

  return { title: title.slice(0, 200), description, area, theme_tags };
}

/**
 * @param {object} p
 * @param {string} p.curatorUserId — `auth.uid()`
 * @param {object} p.course — 선택된 추천 코스
 * @param {object|null} p.courseQueryParsed
 * @param {string} [p.rawSearchQuery]
 * @returns {Promise<{ courseId: string, savedStepCount: number, skippedSteps: number }>}
 */
export async function saveHomeRecommendedCourseDraft({
  curatorUserId,
  course,
  courseQueryParsed,
  rawSearchQuery = "",
}) {
  const uid = String(curatorUserId ?? "").trim();
  if (!uid) {
    const err = new Error("로그인이 필요합니다.");
    err.code = "NOT_AUTHENTICATED";
    throw err;
  }

  const { data: curRow, error: curErr } = await supabase
    .from("curators")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();

  if (curErr || !curRow?.user_id) {
    const err = new Error(
      "큐레이터 계정에서만 내 코스로 저장할 수 있어요."
    );
    err.code = "NOT_CURATOR";
    throw err;
  }

  const { placeRows, skippedSteps, rawStepCount } =
    buildCuratorPlaceRowsFromRecommendedCourse(
      course,
      courseQueryParsed,
      rawSearchQuery
    );

  if (placeRows.length < 2) {
    const err = new Error(
      "저장할 수 있는 주도 DB 장소가 2곳 미만입니다. 일부 장소는 아직 주도 DB 장소가 아니라 코스에 저장할 수 없어요."
    );
    err.code = "INSUFFICIENT_DB_PLACES";
    err.skippedSteps = skippedSteps;
    err.rawStepCount = rawStepCount;
    err.savedStepCount = placeRows.length;
    throw err;
  }

  const meta = buildDraftCoursePayloadFromRecommended(
    course,
    courseQueryParsed,
    rawSearchQuery
  );

  const created = await createCuratorCourse({
    curator_id: uid,
    title: meta.title,
    description: meta.description,
    area: meta.area,
    theme_tags: meta.theme_tags,
    status: "draft",
    is_public: false,
  });

  const newId = created?.id;
  if (!newId) {
    const err = new Error("코스를 만들지 못했습니다.");
    err.code = "CREATE_FAILED";
    throw err;
  }

  await saveCuratorCoursePlaces(
    String(newId),
    placeRows.map((r) => ({
      place_id: r.place_id,
      order_index: r.order_index,
      memo: r.memo != null ? r.memo : null,
      stay_minutes:
        r.stay_minutes != null && Number.isFinite(Number(r.stay_minutes))
          ? Math.max(0, Math.floor(Number(r.stay_minutes)))
          : null,
    }))
  );

  return {
    courseId: String(newId),
    savedStepCount: placeRows.length,
    skippedSteps,
  };
}
