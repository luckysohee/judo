import { describe, expect, it } from "vitest";
import {
  buildCourseStepSchedule,
  courseBookingAction,
  courseBookingBadge,
  formatMinutesAsClock,
  normalizeCourseBookingStatus,
  parseClockToMinutes,
} from "./courseTimeAssurance.js";

describe("courseTimeAssurance", () => {
  it("normalizes booking status", () => {
    expect(normalizeCourseBookingStatus("bookable")).toBe("bookable");
    expect(normalizeCourseBookingStatus("x")).toBe("unknown");
  });

  it("badge prefers crowd note", () => {
    expect(courseBookingBadge("bookable", "금요일 혼잡")?.label).toBe(
      "⚠️ 금요일 혼잡"
    );
    expect(courseBookingBadge("bookable", "")?.label).toBe("✅ 예약 가능");
  });

  it("booking action prefers https then tel", () => {
    expect(
      courseBookingAction("https://booking.example/x", "010-1")?.label
    ).toBe("예약하기");
    expect(courseBookingAction("", "010-1234-5678")?.href).toBe(
      "tel:01012345678"
    );
  });

  it("builds timetable from stay minutes", () => {
    const rows = buildCourseStepSchedule(
      [{ stay_minutes: 70 }, { stay_minutes: 60 }, { stay_minutes: 90 }],
      { startMinutes: 18 * 60, defaultWalkMin: 10 }
    );
    expect(rows[0].arriveLabel).toBe("18:00");
    expect(rows[1].arriveLabel).toBe(formatMinutesAsClock(18 * 60 + 70 + 10));
    expect(parseClockToMinutes("19:20")).toBe(19 * 60 + 20);
  });
});
