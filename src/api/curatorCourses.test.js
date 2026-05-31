import { describe, expect, it } from "vitest";
import * as curatorCourses from "./curatorCourses.js";

describe("curatorCourses API", () => {
  it("exports required functions", () => {
    expect(typeof curatorCourses.createCuratorCourse).toBe("function");
    expect(typeof curatorCourses.updateCuratorCourse).toBe("function");
    expect(typeof curatorCourses.deleteCuratorCourse).toBe("function");
    expect(typeof curatorCourses.fetchCuratorCourseById).toBe("function");
    expect(typeof curatorCourses.fetchPublicCuratorCourses).toBe("function");
    expect(typeof curatorCourses.fetchMyCuratorCourses).toBe("function");
    expect(typeof curatorCourses.saveCuratorCoursePlaces).toBe("function");
    expect(typeof curatorCourses.publishCuratorCourse).toBe("function");
    expect(typeof curatorCourses.duplicateCuratorCourseToMine).toBe(
      "function"
    );
  });
});
