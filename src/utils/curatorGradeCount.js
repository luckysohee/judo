/**
 * 큐레이터 등급 기여 수
 * = 추천 장소 1점 + 직접 만든 코스(스크랩 제외) × 가중치
 *
 * 코스는 장소 여러 곳·동선·글을 묶는 콘텐츠라 장소 1개와 동일하면 안 됨.
 * `curators.total_places` 에 가중 합산값을 저장해 기존 승급 트리거·구간과 호환.
 */
import { supabase } from "../api/client";

/** 직접 만든 코스 1개 = 추천 장소 N개분 */
export const CURATOR_COURSE_GRADE_WEIGHT = 3;

/**
 * @param {number} placeCount
 * @param {number} courseCount
 * @param {number} [courseWeight]
 */
export function gradeContributionTotal(
  placeCount,
  courseCount,
  courseWeight = CURATOR_COURSE_GRADE_WEIGHT
) {
  const p = Math.max(0, Math.floor(Number(placeCount) || 0));
  const c = Math.max(0, Math.floor(Number(courseCount) || 0));
  const w = Math.max(1, Math.floor(Number(courseWeight) || CURATOR_COURSE_GRADE_WEIGHT));
  return p + c * w;
}

/**
 * @param {string} curatorUserId auth uid (= curator_places / curator_courses.curator_id)
 * @param {{ client?: import("@supabase/supabase-js").SupabaseClient }} [opts]
 * @returns {Promise<{
 *   placeCount: number,
 *   courseCount: number,
 *   courseWeight: number,
 *   coursePoints: number,
 *   total: number
 * }>}
 */
export async function countCuratorGradeContributions(curatorUserId, opts = {}) {
  const uid = String(curatorUserId ?? "").trim();
  const courseWeight = CURATOR_COURSE_GRADE_WEIGHT;
  if (!uid) {
    return {
      placeCount: 0,
      courseCount: 0,
      courseWeight,
      coursePoints: 0,
      total: 0,
    };
  }
  const db = opts.client || supabase;

  const [placesRes, coursesRes] = await Promise.all([
    db
      .from("curator_places")
      .select("*", { count: "exact", head: true })
      .eq("curator_id", uid),
    db
      .from("curator_courses")
      .select("*", { count: "exact", head: true })
      .eq("curator_id", uid)
      .is("imported_from_course_id", null),
  ]);

  if (placesRes.error) {
    console.warn("[grade-count] curator_places:", placesRes.error.message || placesRes.error);
  }
  if (coursesRes.error) {
    console.warn("[grade-count] curator_courses:", coursesRes.error.message || coursesRes.error);
  }

  const placeCount =
    typeof placesRes.count === "number" && Number.isFinite(placesRes.count)
      ? placesRes.count
      : 0;
  const courseCount =
    typeof coursesRes.count === "number" && Number.isFinite(coursesRes.count)
      ? coursesRes.count
      : 0;
  const coursePoints = courseCount * courseWeight;

  return {
    placeCount,
    courseCount,
    courseWeight,
    coursePoints,
    total: gradeContributionTotal(placeCount, courseCount, courseWeight),
  };
}

/**
 * 등급용 `curators.total_places` 를 가중 기여 합으로 동기화.
 * @param {string} curatorUserId
 * @param {{ client?: import("@supabase/supabase-js").SupabaseClient }} [opts]
 * @returns {Promise<{
 *   placeCount: number,
 *   courseCount: number,
 *   courseWeight: number,
 *   coursePoints: number,
 *   total: number
 * } | null>}
 */
export async function syncCuratorGradeTotalPlaces(curatorUserId, opts = {}) {
  const uid = String(curatorUserId ?? "").trim();
  if (!uid) return null;
  const db = opts.client || supabase;

  const counts = await countCuratorGradeContributions(uid, { client: db });
  const { error } = await db
    .from("curators")
    .update({
      total_places: counts.total,
      last_activity_at: new Date().toISOString(),
    })
    .eq("user_id", uid);

  if (error) {
    console.warn("[grade-count] sync total_places:", error.message || error);
    return null;
  }
  return counts;
}
