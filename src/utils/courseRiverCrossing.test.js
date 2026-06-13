import { describe, expect, it } from "vitest";
import {
  courseWalkCrossesHanRiver,
  isNorthOfHanRiver,
} from "./courseRiverCrossing";

describe("courseWalkCrossesHanRiver", () => {
  it("성수(북) → 청담(남) 은 한강 건너편", () => {
    expect(
      courseWalkCrossesHanRiver(37.5447, 127.0565, 37.5194, 127.0495)
    ).toBe(true);
  });

  it("성수 → 성수 인근 은 같은 둑", () => {
    expect(
      courseWalkCrossesHanRiver(37.5447, 127.0565, 37.541, 127.052)
    ).toBe(false);
  });

  it("강남(남) → 역삼 은 같은 둑", () => {
    expect(
      courseWalkCrossesHanRiver(37.4979, 127.0276, 37.5, 127.036)
    ).toBe(false);
  });

  it("isNorthOfHanRiver: 성수는 북, 청담은 남", () => {
    expect(isNorthOfHanRiver(37.5447, 127.0565)).toBe(true);
    expect(isNorthOfHanRiver(37.5194, 127.0495)).toBe(false);
  });
});
