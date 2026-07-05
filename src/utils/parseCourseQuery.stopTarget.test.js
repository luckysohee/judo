import { describe, expect, it } from "vitest";
import {
  courseStopTargetForDraft,
  parseCourseQuery,
  parseRoundStopCount,
  sanitizeCourseDraftForStopCount,
} from "./parseCourseQuery.js";

describe("parseRoundStopCount", () => {
  it("reads digit N차", () => {
    expect(parseRoundStopCount("문래 3차")).toBe(3);
    expect(parseRoundStopCount("4차 코스")).toBe(4);
    expect(parseRoundStopCount("삼차")).toBe(3);
    expect(parseRoundStopCount("사차")).toBe(4);
  });
});

describe("courseStopTargetForDraft", () => {
  it("AI 코스는 최소 2곳", () => {
    const t = courseStopTargetForDraft({
      raw: "성수 빵",
      forAiCourseDraft: true,
    });
    expect(t.min).toBe(2);
    expect(t.exact).toBe(false);
  });

  it("3차는 정확히 3곳", () => {
    const t = courseStopTargetForDraft({
      raw: "문래 3차",
      forAiCourseDraft: true,
    });
    expect(t).toMatchObject({ min: 3, max: 3, exact: true, target: 3 });
  });

  it("4차는 정확히 4곳", () => {
    const t = courseStopTargetForDraft({
      raw: "합정 4차",
      forAiCourseDraft: true,
    });
    expect(t).toMatchObject({ min: 4, max: 4, exact: true, target: 4 });
  });
});

describe("parseCourseQuery forAiCourseDraft", () => {
  it("attaches stopTarget on parsed", () => {
    const p = parseCourseQuery("문래 3차", { forAiCourseDraft: true });
    expect(p.stopTarget.target).toBe(3);
    expect(p.forAiCourseDraft).toBe(true);
  });
});

describe("sanitizeCourseDraftForStopCount", () => {
  it("trims extra steps when exact", () => {
    const draft = {
      steps: [{ placeKey: "a" }, { placeKey: "b" }, { placeKey: "c" }, { placeKey: "d" }],
    };
    const out = sanitizeCourseDraftForStopCount(draft, {
      min: 3,
      max: 3,
      exact: true,
      target: 3,
    });
    expect(out.steps).toHaveLength(3);
  });
});
