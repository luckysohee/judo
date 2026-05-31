import { describe, expect, it } from "vitest";
import { formatCompletionDurationLabel } from "./completedCourseLogs.js";

describe("formatCompletionDurationLabel", () => {
  it("formats minutes", () => {
    expect(formatCompletionDurationLabel(120)).toMatch(/약 2분/);
  });
  it("formats hours", () => {
    expect(formatCompletionDurationLabel(7200)).toMatch(/약 2시간/);
  });
});
