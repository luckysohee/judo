import { describe, expect, it } from "vitest";
import * as courseSessions from "./courseSessions.js";

describe("courseSessions API", () => {
  it("exports session helpers", () => {
    expect(typeof courseSessions.getMyActiveCourseSession).toBe("function");
    expect(typeof courseSessions.startCourseSession).toBe("function");
    expect(typeof courseSessions.updateCourseSessionStep).toBe("function");
    expect(typeof courseSessions.completeCourseSession).toBe("function");
    expect(typeof courseSessions.abandonCourseSession).toBe("function");
    expect(typeof courseSessions.normalizeActiveCourseSessionRow).toBe(
      "function"
    );
  });

  it("normalizeActiveCourseSessionRow flattens embed", () => {
    const row = {
      id: "a",
      course_id: "b",
      curator_courses: { id: "b", title: "T" },
    };
    const n = courseSessions.normalizeActiveCourseSessionRow(row);
    expect(n.course).toEqual({ id: "b", title: "T" });
  });
});
