import { describe, expect, it } from "vitest";
import {
  homeCoursesDiscoverySheetHeightPxForSnap,
  homeCoursesDiscoveryStampSheetHeightPx,
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
