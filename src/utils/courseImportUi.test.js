import { describe, expect, it } from "vitest";
import {
  canEditCuratorCourse,
  isImportedCuratorCourse,
  isMyImportedCourseSnapshot,
  splitMyCuratorCourses,
} from "./courseImportUi";

describe("courseImportUi", () => {
  it("detects imported snapshot rows", () => {
    expect(isImportedCuratorCourse({ imported_from_course_id: "abc" })).toBe(
      true
    );
    expect(isImportedCuratorCourse({ title: "x" })).toBe(false);
  });

  it("allows edit only for authored own courses", () => {
    const uid = "user-1";
    expect(
      canEditCuratorCourse({ curator_id: uid, title: "x" }, uid)
    ).toBe(true);
    expect(
      canEditCuratorCourse(
        { curator_id: uid, imported_from_course_id: "src" },
        uid
      )
    ).toBe(false);
    expect(isMyImportedCourseSnapshot(
      { curator_id: uid, imported_from_course_id: "src" },
      uid
    )).toBe(true);
  });

  it("splits own vs imported courses", () => {
    const { ownCourses, importedCourses } = splitMyCuratorCourses([
      { id: "1", title: "mine" },
      { id: "2", title: "theirs", imported_from_course_id: "src" },
    ]);
    expect(ownCourses).toHaveLength(1);
    expect(importedCourses).toHaveLength(1);
  });
});
