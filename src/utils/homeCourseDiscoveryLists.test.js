import { describe, expect, it } from "vitest";
import {
  buildHomeCourseDiscoveryPeekList,
  filterCoursesForDiscoverySearch,
  partitionHomeCourseDiscovery,
  pickEditorFeaturedCourses,
  pickWeeklyRankingCourses,
} from "./homeCourseDiscoveryLists.js";

const c = (id, extra = {}) => ({
  id,
  title: `Course ${id}`,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

describe("homeCourseDiscoveryLists", () => {
  it("partitions 4 editor + 4 weekly without overlap", () => {
    const courses = [
      c("a", { cover_image_url: "x", description: "nice" }),
      c("b"),
      c("c"),
      c("d"),
      c("e"),
      c("f"),
      c("g"),
      c("h"),
    ];
    const stats = new Map([
      ["e", { recent_completion_count_7d: 5, completion_count: 10 }],
      ["b", { recent_completion_count_7d: 2, completion_count: 1 }],
    ]);
    const { editorPicks, weeklyRanking } = partitionHomeCourseDiscovery(
      courses,
      stats
    );
    expect(editorPicks).toHaveLength(4);
    expect(weeklyRanking).toHaveLength(4);
    const editorIds = new Set(editorPicks.map((x) => x.id));
    for (const w of weeklyRanking) {
      expect(editorIds.has(w.id)).toBe(false);
    }
    expect(weeklyRanking[0].id).toBe("e");
  });

  it("manual editor ids take priority", () => {
    const courses = [c("x"), c("y", { cover_image_url: "z" })];
    const picks = pickEditorFeaturedCourses(courses, new Map(), {
      limit: 1,
      manualIds: ["x"],
    });
    expect(picks).toHaveLength(1);
    expect(picks[0].id).toBe("x");
  });

  it("filters search by title and area", () => {
    const courses = [
      c("1", { title: "홍대 맥주", area: "마포" }),
      c("2", { title: "강남", area: "서초" }),
    ];
    const out = filterCoursesForDiscoverySearch(courses, "홍대");
    expect(out.map((x) => x.id)).toEqual(["1"]);
    const out2 = filterCoursesForDiscoverySearch(courses, "서초");
    expect(out2.map((x) => x.id)).toEqual(["2"]);
  });

  it("weekly ranking prefers 7d completions", () => {
    const courses = [c("a"), c("b")];
    const stats = new Map([
      ["a", { recent_completion_count_7d: 0, completion_count: 99 }],
      ["b", { recent_completion_count_7d: 3, completion_count: 1 }],
    ]);
    const ranked = pickWeeklyRankingCourses(courses, stats, { limit: 2 });
    expect(ranked[0].id).toBe("b");
  });

  it("MVP backfills weekly when editor took all courses (2 total)", () => {
    const courses = [
      c("a", { cover_image_url: "x", description: "nice" }),
      c("b", { cover_image_url: "y" }),
    ];
    const { editorPicks, weeklyRanking } = partitionHomeCourseDiscovery(
      courses,
      new Map()
    );
    expect(editorPicks).toHaveLength(2);
    expect(weeklyRanking).toHaveLength(2);
    expect(weeklyRanking.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("buildHomeCourseDiscoveryPeekList merges editor then weekly without dupes", () => {
    const peek = buildHomeCourseDiscoveryPeekList(
      [c("a"), c("b")],
      [c("b"), c("c")],
      3
    );
    expect(peek.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});
