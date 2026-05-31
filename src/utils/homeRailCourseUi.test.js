import { describe, expect, it } from "vitest";
import {
  homeRailCourseMapFitPadding,
  homeRailCourseSheetHeightPx,
  HOME_RAIL_COURSE_SHEET_VH,
} from "./homeRailCourseUi";

describe("homeRailCourseUi", () => {
  it("sheet height matches hot strip courses panel; expanded uses vh", () => {
    expect(homeRailCourseSheetHeightPx(900, false)).toBe(212);
    expect(homeRailCourseSheetHeightPx(900, true)).toBe(450);
    expect(HOME_RAIL_COURSE_SHEET_VH).toBeCloseTo(33.333, 2);
  });

  it("map fit padding reserves bottom sheet space", () => {
    const pad = homeRailCourseMapFitPadding(300);
    expect(pad.bottom).toBeGreaterThan(300);
    expect(pad.top).toBeGreaterThan(0);
  });
});
