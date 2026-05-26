import { describe, expect, it } from "vitest";
import {
  COURSE_STAMP_VISIBLE_SLOTS,
  courseStampStepCellStyle,
  courseStampStepDensity,
  courseStampStepRowStyle,
  isCourseStampStepRowScrollable,
  normalizeCourseStampStepCount,
} from "./courseStampStepLayout";

describe("courseStampStepLayout", () => {
  it("caps step count at 6", () => {
    expect(normalizeCourseStampStepCount([1, 2, 3, 4, 5, 6, 7])).toBe(6);
  });

  it("uses equal flex cells when 4 or fewer", () => {
    expect(courseStampStepCellStyle(4)).toEqual({
      flex: "1 1 0",
      minWidth: 0,
      maxWidth: "100%",
    });
    expect(isCourseStampStepRowScrollable(4)).toBe(false);
    expect(courseStampStepRowStyle(4).overflowX).toBe("hidden");
  });

  it("enables horizontal scroll when more than 4 places", () => {
    expect(isCourseStampStepRowScrollable(5)).toBe(true);
    expect(courseStampStepRowStyle(5).overflowX).toBe("auto");
    expect(courseStampStepCellStyle(5).flex).toMatch(/^0 0 calc/);
    expect(COURSE_STAMP_VISIBLE_SLOTS).toBe(4);
  });

  it("uses 4-slot density for 5+ places", () => {
    const d4 = courseStampStepDensity(4);
    const d6 = courseStampStepDensity(6);
    expect(d6.thumbMaxHeight).toBe(d4.thumbMaxHeight);
  });
});
