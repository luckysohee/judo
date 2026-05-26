import { describe, expect, it } from "vitest";
import { homeCoursesDiscoveryStampSheetHeightPx } from "./homeHotStripLayout";

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
