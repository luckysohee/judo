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

/** 공개 코스만 복제 API 허용 */
export function canDuplicatePublishedPublicCourse(course) {
  if (!course || typeof course !== "object") return false;
  return course.status === "published" && Boolean(course.is_public);
}

/**
 * Web Share API 우선, 실패 시 클립보드.
 * @returns {Promise<'shared'|'clipboard'|'aborted'>}
 */
export async function shareOrCopyCourseLink({ url, title, text }) {
  const u = String(url ?? "").trim();
  if (!u) throw new Error("shareOrCopyCourseLink: url required");

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        title: title || "코스",
        text: String(text ?? title ?? "").trim() || title || "",
        url: u,
      });
      return "shared";
    } catch (e) {
      if (e && (e.name === "AbortError" || String(e.message || "").includes("Abort"))) {
        return "aborted";
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(u);
    return "clipboard";
  }

  const err = new Error("CLIPBOARD_UNAVAILABLE");
  err.url = u;
  throw err;
}
