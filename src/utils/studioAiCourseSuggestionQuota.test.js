import { describe, expect, it } from "vitest";
import {
  formatStudioAiQuotaLine,
  normalizeStudioAiCourseSuggestionQuota,
  studioAiQuotaExceededMessage,
} from "./studioAiCourseSuggestionQuota.js";

describe("studioAiCourseSuggestionQuota", () => {
  it("normalize free tier quota", () => {
    const q = normalizeStudioAiCourseSuggestionQuota({
      ok: true,
      is_pro: false,
      limit: 5,
      used: 2,
      remaining: 3,
      period_label: "2026-07",
    });
    expect(q?.canUse).toBe(true);
    expect(formatStudioAiQuotaLine(q)).toContain("2/5");
  });

  it("normalize pro quota", () => {
    const q = normalizeStudioAiCourseSuggestionQuota({
      ok: true,
      is_pro: true,
      used: 12,
      remaining: null,
    });
    expect(q?.canUse).toBe(true);
    expect(formatStudioAiQuotaLine(q)).toContain("무제한");
  });

  it("exceeded message mentions Pro", () => {
    expect(studioAiQuotaExceededMessage({ limit: 5 })).toContain("Studio Pro");
  });
});
