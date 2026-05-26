import { describe, expect, it } from "vitest";
import { walkingRouteDisplayMinutes } from "./courseWalkingRouteQuality.js";
import { buildCourseWalkingLegLabel } from "./courseRouteLegLabels.js";

describe("walkingRouteDisplayMinutes", () => {
  it("uses distance-based minutes when duration is missing", () => {
    expect(walkingRouteDisplayMinutes(1400, 0)).toBe(20);
  });

  it("uses the larger of distance and duration estimates", () => {
    expect(walkingRouteDisplayMinutes(1400, 60)).toBe(20);
    expect(walkingRouteDisplayMinutes(200, 600)).toBe(10);
  });
});

describe("buildCourseWalkingLegLabel straight fallback", () => {
  it("does not show 1 minute for 1.4km straight leg without routed meters", () => {
    const label = buildCourseWalkingLegLabel("1차", "2차", 0, 0, 1400);
    expect(label).toContain("1.4km");
    expect(label).toContain("20분");
    expect(label).not.toContain("1분");
  });
});
