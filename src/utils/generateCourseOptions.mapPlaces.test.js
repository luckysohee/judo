import { describe, expect, it } from "vitest";
import {
  courseOptionsToMapPlaces,
  resolveCourseStepMapCaption,
} from "./generateCourseOptions.js";

describe("courseOptionsToMapPlaces", () => {
  it("resolveCourseStepMapCaption — 3단 가운데는 쩜오차", () => {
    expect(resolveCourseStepMapCaption({ step: 1 }, 3)).toBe("1차");
    expect(resolveCourseStepMapCaption({ step: 2 }, 3)).toBe("쩜오차");
    expect(resolveCourseStepMapCaption({ step: 3 }, 3)).toBe("2차");
  });

  it("3단 코스 — 1·쩜오·2 마커 모두 포함", () => {
    const places = courseOptionsToMapPlaces([
      {
        steps: [
          {
            step: 1,
            place: {
              id: "a",
              name: "1차집",
              lat: 37.5,
              lng: 127.0,
            },
          },
          {
            step: 2,
            place: {
              id: "b",
              name: "쩜오카페",
              lat: 37.501,
              lng: 127.001,
            },
          },
          {
            step: 3,
            place: {
              id: "c",
              name: "2차집",
              lat: 37.502,
              lng: 127.002,
            },
          },
        ],
      },
    ]);
    expect(places).toHaveLength(3);
    expect(places.map((p) => p.courseMapCaption)).toEqual([
      "1차",
      "쩜오차",
      "2차",
    ]);
    expect(places.map((p) => p.name)).toEqual(["1차집", "쩜오카페", "2차집"]);
  });
});
