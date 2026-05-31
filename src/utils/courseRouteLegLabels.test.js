import { describe, expect, it } from "vitest";
import {
  buildCourseWalkingLegLabel,
  filterCourseRouteOverlayForStamps,
  remainingCourseLegIndices,
} from "./courseRouteLegLabels";

describe("courseRouteLegLabels", () => {
  it("prefixes leg range in label", () => {
    const t = buildCourseWalkingLegLabel("1차", "2차", 420, 360, 400);
    expect(t).toMatch(/^1차→2차/);
    expect(t).toContain("도보");
  });

  it("drops legs starting at a stamped step", () => {
    const drive = {
      steps: [
        { place: { id: "a" } },
        { place: { id: "b" } },
        { place: { id: "c" } },
      ],
    };
    const indices = remainingCourseLegIndices(drive, new Set(["a"]));
    expect(indices).toEqual([1]);
  });

  it("filters path and labels to remaining legs", () => {
    const drive = {
      steps: [
        { place: { id: "a" } },
        { place: { id: "b" } },
        { place: { id: "c" } },
      ],
    };
    const waypoints = [
      { lat: 37, lng: 127 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.002, lng: 127.002 },
    ];
    const route = {
      legs: [
        { path: [{ lat: 37, lng: 127 }, { lat: 37.001, lng: 127.001 }] },
        { path: [{ lat: 37.001, lng: 127.001 }, { lat: 37.002, lng: 127.002 }] },
      ],
    };
    const legLabels = [
      { legLabel: "1→2", position: waypoints[0] },
      { legLabel: "2→3", position: waypoints[1] },
    ];
    const { path, legLabels: out } = filterCourseRouteOverlayForStamps(
      drive,
      { path: null, legLabels, route, waypoints, stepLabels: ["1", "2", "3"] },
      new Set(["a"])
    );
    expect(out).toHaveLength(1);
    expect(out[0].legLabel).toBe("2→3");
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual({ lat: 37.001, lng: 127.001 });
  });
});
