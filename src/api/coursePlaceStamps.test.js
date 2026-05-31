import { describe, expect, it } from "vitest";
import {
  resolveCourseGuideStepIndex,
  areAllCourseStepsStamped,
  verifyStampDeleteResult,
} from "./coursePlaceStamps.js";

describe("resolveCourseGuideStepIndex", () => {
  const steps = [
    { place_id: "a", order_index: 0 },
    { place_id: "b", order_index: 1 },
    { place_id: "c", order_index: 2 },
  ];

  it("returns first unstamped step", () => {
    expect(resolveCourseGuideStepIndex(3, new Set(["a"]), steps)).toBe(1);
  });

  it("returns last index when all stamped", () => {
    expect(
      resolveCourseGuideStepIndex(3, new Set(["a", "b", "c"]), steps)
    ).toBe(2);
  });
});

describe("areAllCourseStepsStamped", () => {
  const steps = [
    { place_id: "a", order_index: 0 },
    { place_id: "b", order_index: 1 },
  ];

  it("false when any step missing", () => {
    expect(areAllCourseStepsStamped(steps, new Set(["a"]))).toBe(false);
  });

  it("true when every step stamped", () => {
    expect(areAllCourseStepsStamped(steps, new Set(["a", "b"]))).toBe(true);
  });
});

describe("verifyStampDeleteResult", () => {
  it("fails when stamps existed but none deleted", () => {
    expect(verifyStampDeleteResult(3, 0)).toEqual({
      ok: false,
      reason: "delete_blocked",
    });
  });

  it("ok when nothing to delete", () => {
    expect(verifyStampDeleteResult(0, 0)).toEqual({ ok: true });
  });

  it("ok when rows deleted", () => {
    expect(verifyStampDeleteResult(2, 2)).toEqual({ ok: true });
  });
});
