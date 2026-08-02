import { describe, expect, it } from "vitest";
import {
  homeCoursesDiscoverySheetHeightPxForSnap,
  homeCoursesDiscoveryStampSheetHeightPx,
  homeListsDiscoveryBrowseExpandedPx,
  homeListsDiscoverySheetHeightPxForSnap,
} from "./homeHotStripLayout";

describe("homeCoursesDiscoveryStampSheetHeightPx", () => {
  it("stays in a compact range for stamp UI", () => {
    expect(homeCoursesDiscoveryStampSheetHeightPx(4)).toBeGreaterThan(130);
    expect(homeCoursesDiscoveryStampSheetHeightPx(4)).toBeLessThan(220);
  });

  it("uses smaller thumbs when there are more steps", () => {
    expect(homeCoursesDiscoveryStampSheetHeightPx(6)).toBeLessThan(
      homeCoursesDiscoveryStampSheetHeightPx(3)
    );
  });
});

describe("homeCoursesDiscoverySheetHeightPxForSnap", () => {
  it("returns tier heights for browse snaps", () => {
    expect(
      homeCoursesDiscoverySheetHeightPxForSnap("minimized", {
        browseMode: true,
        layoutHeightPx: 800,
      })
    ).toBe(52);
    expect(
      homeCoursesDiscoverySheetHeightPxForSnap("collapsed", {
        browseMode: true,
        layoutHeightPx: 800,
      })
    ).toBe(178);
    expect(
      homeCoursesDiscoverySheetHeightPxForSnap("expanded", {
        browseMode: true,
        layoutHeightPx: 800,
      })
    ).toBe(400);
  });
});

describe("homeListsDiscoveryBrowseExpandedPx", () => {
  it("is taller than course discovery expanded (~50%) so fit padding matches sheet", () => {
    const listExpanded = homeListsDiscoveryBrowseExpandedPx(800);
    expect(listExpanded).toBeGreaterThanOrEqual(Math.round(800 * 0.62));
    expect(listExpanded).toBeLessThanOrEqual(Math.round(800 * 0.68));
    expect(
      homeListsDiscoverySheetHeightPxForSnap("expanded", {
        browseMode: true,
        layoutHeightPx: 800,
      })
    ).toBe(listExpanded);
  });
});
