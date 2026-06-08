import { describe, expect, it } from "vitest";
import {
  buildCourseVenueNameLabelSvg,
  shouldShowCourseVenueNameLabel,
} from "./mapMarkerVenueLabel.js";

describe("mapMarkerVenueLabel", () => {
  it("shows label for fixed course pins only", () => {
    expect(
      shouldShowCourseVenueNameLabel({
        isCoursePin: true,
        courseMarkerPulse: false,
      })
    ).toBe(true);
    expect(
      shouldShowCourseVenueNameLabel({
        isCoursePin: true,
        courseMarkerPulse: true,
      })
    ).toBe(false);
  });

  it("renders venue name svg", () => {
    const { svg, height, width } = buildCourseVenueNameLabelSvg(20, 40, {
      isCoursePin: true,
      name: "테스트 상호",
    });
    expect(height).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(0);
    expect(svg).toContain("테스트 상호");
  });
});
