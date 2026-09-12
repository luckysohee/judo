const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuidCourseId(id) {
  const s = String(id ?? "").trim();
  return Boolean(s && UUID_RE.test(s));
}

/**
 * 작성자 전용 배지 (draft / 비공개). 공개 코스는 null.
 * @param {object|null} course
 * @returns {{ kind: string, label: string } | null}
 */
export function getCourseVisibilityBadge(course) {
  if (!course || typeof course !== "object") return null;
  const st = String(course.status ?? "").trim();
  if (st === "draft") {
    return { kind: "draft", label: "임시저장" };
  }
  if (st === "private") {
    return { kind: "private", label: "비공개 코스" };
  }
  if (st === "published" && !course.is_public) {
    return { kind: "private", label: "비공개 코스" };
  }
  return null;
}

/** 공개·발행 코스만 좋아요·저장(북마크) 등 상호작용 허용 */
export function canDuplicatePublishedPublicCourse(course) {
  if (!course || typeof course !== "object") return false;
  return course.status === "published" && Boolean(course.is_public);
}

/** @deprecated 이름만 다름 — 즐겨찾기 저장용 */
export function canBookmarkPublishedPublicCourse(course) {
  return canDuplicatePublishedPublicCourse(course);
}

/**
 * 네이티브 Share 시트 → Web Share API → 클립보드.
 * @returns {Promise<'shared'|'clipboard'|'aborted'>}
 */
export async function shareOrCopyCourseLink({ url, title, text }) {
  const { shareOrCopy } = await import("../lib/native/share");
  return shareOrCopy({
    url,
    title: title || "코스",
    text: String(text ?? title ?? "").trim() || title || "",
    dialogTitle: "코스 공유",
  });
}
