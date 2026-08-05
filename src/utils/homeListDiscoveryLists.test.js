import { describe, expect, it } from "vitest";
import {
  buildHomeListDiscoveryUnifiedList,
  pickHomeListLikeMetricLine,
  weeklyListRankingScore,
} from "./homeListDiscoveryLists";

function list(id, extra = {}) {
  return { id, title: id, updated_at: "2026-01-01T00:00:00Z", ...extra };
}

describe("homeListDiscoveryLists", () => {
  it("scores recent likes higher", () => {
    expect(
      weeklyListRankingScore({ recent_like_count_7d: 2, like_count: 1 })
    ).toBeGreaterThan(
      weeklyListRankingScore({ recent_like_count_7d: 0, like_count: 50 })
    );
  });

  it("marks weekly #1 and rising badges", () => {
    const stats = new Map([
      ["a", { recent_like_count_7d: 5, like_count: 10 }],
      ["b", { recent_like_count_7d: 2, like_count: 3 }],
      ["c", { recent_like_count_7d: 0, like_count: 1 }],
    ]);
    const rows = buildHomeListDiscoveryUnifiedList(
      [list("c"), list("a"), list("b")],
      stats
    );
    expect(rows[0].list.id).toBe("a");
    expect(rows[0].badge).toEqual({ emoji: "🔥", text: "이번주 1위" });
    expect(rows[1].badge?.text).toBe("급상승");
  });

  it("formats like metric lines", () => {
    expect(
      pickHomeListLikeMetricLine({ recent_like_count_7d: 3, like_count: 9 })
    ).toEqual({ emoji: "❤️", text: "이번주 좋아요 3" });
    expect(
      pickHomeListLikeMetricLine({ recent_like_count_7d: 0, like_count: 4 })
    ).toEqual({ emoji: "♡", text: "좋아요 4" });
    expect(pickHomeListLikeMetricLine({})).toBeNull();
  });
});
