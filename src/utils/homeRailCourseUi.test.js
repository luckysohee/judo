import { describe, expect, it } from "vitest";
import {
  homeListsMapFitPadding,
  homeRailCourseMapFitPadding,
  homeRailCourseSheetHeightPx,
  HOME_RAIL_COURSE_SHEET_VH,
  measureHomeListsSheetObscuredBottomPx,
} from "./homeRailCourseUi";

describe("homeRailCourseUi", () => {
  it("sheet height matches hot strip courses panel; expanded uses vh", () => {
    expect(homeRailCourseSheetHeightPx(900, false)).toBeGreaterThan(100);
    expect(homeRailCourseSheetHeightPx(900, true)).toBe(450);
    expect(HOME_RAIL_COURSE_SHEET_VH).toBeCloseTo(33.333, 2);
  });

  it("map fit padding reserves bottom sheet space", () => {
    const pad = homeRailCourseMapFitPadding(300);
    expect(pad.bottom).toBeGreaterThan(300);
    expect(pad.top).toBeGreaterThan(0);
  });

  it("list fit padding keeps full sheet+dock below (never shrinks bottom)", () => {
    const list = homeListsMapFitPadding(400);
    expect(list.bottom).toBeGreaterThanOrEqual(400 + 18);
    expect(list.top).toBeLessThan(40);
  });

  it("list fit padding prefers measured obscured bottom", () => {
    const list = homeListsMapFitPadding(400, { obscuredBottomPx: 520 });
    expect(list.bottom).toBe(530);
  });

  it("measures panel obscured bottom from rect top", () => {
    const panel = {
      getBoundingClientRect: () => ({ top: 300 }),
    };
    expect(measureHomeListsSheetObscuredBottomPx(panel, 800)).toBe(500);
  });
});
