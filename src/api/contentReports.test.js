import { describe, expect, it } from "vitest";
import { REPORT_REASONS, REPORT_TARGET_TYPES } from "./contentReports";
import { LEGAL } from "../config/legal";

describe("UGC safety constants", () => {
  it("exposes report reasons and target types for Guideline 1.2", () => {
    expect(REPORT_REASONS.length).toBeGreaterThanOrEqual(5);
    expect(REPORT_REASONS.every((r) => r.id && r.label)).toBe(true);
    expect(REPORT_TARGET_TYPES).toContain("course");
    expect(REPORT_TARGET_TYPES).toContain("profile");
    expect(REPORT_TARGET_TYPES).toContain("place");
  });

  it("has contact email and terms version for consent records", () => {
    expect(LEGAL.contactEmail).toMatch(/@/);
    expect(LEGAL.termsVersion).toBeTruthy();
  });
});
