import { describe, expect, it } from "vitest";
import {
  formatCourseEngagementSocialSummary,
  formatCuratorCourseCompletionFollowerChip,
  mergeCourseEngagementStats,
  pickStudioCourseEngagementLines,
} from "../api/courseCompletionStats";

describe("pickStudioCourseEngagementLines", () => {
  it("includes completion and like lines", () => {
    const stats = mergeCourseEngagementStats(
      { completion_count: 3, recent_completion_count_7d: 1 },
      { like_count: 5, recent_like_count_7d: 2 }
    );
    const lines = pickStudioCourseEngagementLines(stats);
    expect(lines.some((l) => l.key === "7d")).toBe(true);
    expect(lines.some((l) => l.key === "likes7d")).toBe(true);
  });

  it("shows total likes when no recent likes", () => {
    const lines = pickStudioCourseEngagementLines(
      mergeCourseEngagementStats(
        { completion_count: 0 },
        { like_count: 4, recent_like_count_7d: 0 }
      )
    );
    expect(lines).toEqual([
      { key: "likes", emoji: "♥", text: "좋아요 4" },
    ]);
  });
});

describe("formatCuratorCourseCompletionFollowerChip", () => {
  it("prefers weekly completions", () => {
    expect(
      formatCuratorCourseCompletionFollowerChip({
        recent_completion_count_7d: 2,
        total_completion_count: 5,
      })
    ).toBe("이번 주 2명 코스 완주");
  });

  it("falls back to total when no recent", () => {
    expect(
      formatCuratorCourseCompletionFollowerChip({
        recent_completion_count_7d: 0,
        total_completion_count: 3,
      })
    ).toBe("총 3명 코스 완주");
  });

  it("returns null when empty", () => {
    expect(formatCuratorCourseCompletionFollowerChip(null)).toBeNull();
  });
});

describe("formatCourseEngagementSocialSummary", () => {
  it("joins completion and likes", () => {
    const s = formatCourseEngagementSocialSummary(
      mergeCourseEngagementStats(
        { completion_count: 2, recent_completion_count_7d: 0 },
        { like_count: 3, recent_like_count_7d: 1 }
      )
    );
    expect(s).toContain("완주");
    expect(s).toContain("좋아요");
  });
});
