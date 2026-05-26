/** @param {object|null|undefined} course */
export function isImportedCuratorCourse(course) {
  if (!course || typeof course !== "object") return false;
  return Boolean(String(course.imported_from_course_id ?? "").trim());
}

/** 직접 작성한 코스(가져온 스냅샷 아님) */
export function isAuthoredCuratorCourse(course) {
  return Boolean(course) && !isImportedCuratorCourse(course);
}

/**
 * @param {object|null|undefined} course
 * @param {string|null|undefined} userId
 */
export function isMyImportedCourseSnapshot(course, userId) {
  const uid = String(userId ?? "").trim();
  if (!uid || !isImportedCuratorCourse(course)) return false;
  return String(course.curator_id ?? "").trim() === uid;
}

/**
 * @param {object|null|undefined} course
 * @param {string|null|undefined} userId
 */
export function canEditCuratorCourse(course, userId) {
  const uid = String(userId ?? "").trim();
  if (!uid || !isAuthoredCuratorCourse(course)) return false;
  return String(course.curator_id ?? "").trim() === uid;
}

/**
 * @param {object[]} rows
 * @returns {{ ownCourses: object[], importedCourses: object[] }}
 */
export function splitMyCuratorCourses(rows) {
  const ownCourses = [];
  const importedCourses = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (isImportedCuratorCourse(row)) importedCourses.push(row);
    else ownCourses.push(row);
  }
  return { ownCourses, importedCourses };
}
