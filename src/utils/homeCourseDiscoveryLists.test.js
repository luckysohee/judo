import { describe, expect, it } from "vitest";
import {
  buildHomeCourseDiscoveryPeekList,
  buildHomeCourseDiscoveryUnifiedList,
  filterCoursesForDiscoverySearch,
  partitionHomeCourseDiscovery,
  pickEditorFeaturedCourses,
  pickWeeklyRankingCourses,
  resolveHomeCourseDiscoveryBadge,
} from "./homeCourseDiscoveryLists.js";

const c = (id, extra = {}) => ({
  id,
  title: `Course ${id}`,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

describe("homeCourseDiscoveryLists", () => {
  it("partitions 6 editor + 6 weekly without overlap", () => {
    const courses = [
      c("a", { cover_image_url: "x", description: "nice" }),
      c("b"),
      c("c"),
      c("d"),
      c("e"),
      c("f"),
      c("g"),
      c("h"),
      c("i"),
      c("j"),
      c("k"),
      c("l"),
      c("m"),
    ];
    const stats = new Map([
      ["g", { recent_completion_count_7d: 5, completion_count: 10 }],
      ["h", { recent_completion_count_7d: 4, completion_count: 8 }],
      ["i", { recent_completion_count_7d: 3, completion_count: 6 }],
      ["j", { recent_completion_count_7d: 2, completion_count: 4 }],
      ["k", { recent_completion_count_7d: 1, completion_count: 2 }],
      ["l", { recent_completion_count_7d: 0, completion_count: 1 }],
      ["b", { recent_completion_count_7d: 2, completion_count: 1 }],
    ]);
    const { editorPicks, weeklyRanking } = partitionHomeCourseDiscovery(
      courses,
      stats
    );
    expect(editorPicks).toHaveLength(6);
    expect(weeklyRanking).toHaveLength(6);
    const editorIds = new Set(editorPicks.map((x) => x.id));
    for (const w of weeklyRanking) {
      expect(editorIds.has(w.id)).toBe(false);
    }
    expect(weeklyRanking[0].id).toBe("g");
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

  it("matches curator 별명 and @handle", () => {
    const courses = [
      c("1", { title: "코스A", curator_id: "u1" }),
      c("2", { title: "코스B", curator_id: "u2" }),
    ];
    const nameByCurator = new Map([
      ["u1", "노포킬러 @nopo"],
      ["u2", "다른사람 @other"],
    ]);
    const nicknameByCurator = new Map([
      ["u1", "노포킬러"],
      ["u2", "다른사람"],
    ]);
    expect(
      filterCoursesForDiscoverySearch(courses, "노포", {
        nameByCurator,
        nicknameByCurator,
      }).map((x) => x.id)
    ).toEqual(["1"]);
    expect(
      filterCoursesForDiscoverySearch(courses, "@nopo", {
        nameByCurator,
        nicknameByCurator,
      }).map((x) => x.id)
    ).toEqual(["1"]);
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
    const stats = new Map([
      ["a", { recent_completion_count_7d: 0 }],
      ["b", { recent_completion_count_7d: 0 }],
      ["c", { recent_completion_count_7d: 3 }],
    ]);
    const peek = buildHomeCourseDiscoveryPeekList(
      [c("a"), c("b")],
      [c("b"), c("c")],
      3,
      stats
    );
    expect(peek.map((x) => x.course.id)).toEqual(["b", "c", "a"]);
    expect(peek[0].badge).toEqual({ emoji: "🔥", text: "이번주 1위" });
    expect(peek[1].badge).toEqual({ emoji: "🚀", text: "급상승" });
    expect(peek[2].badge).toBeNull();
  });

  it("caps rising badges at three across unified list", () => {
    const weekly = ["top", "w2", "w3", "w4", "w5"].map((id) => c(id));
    const stats = new Map(
      weekly.map((row, i) => [
        row.id,
        { recent_completion_count_7d: 5 - i, completion_count: 1 },
      ])
    );
    const list = buildHomeCourseDiscoveryUnifiedList([], weekly, stats, {
      limit: 5,
    });
    const rising = list.filter((row) => row.badge?.text === "급상승");
    expect(rising).toHaveLength(3);
    expect(list[0].badge?.text).toBe("이번주 1위");
    expect(list[1].badge?.text).toBe("급상승");
    expect(list[4].badge).toBeNull();
  });

  it("resolveHomeCourseDiscoveryBadge returns null for editor-only course", () => {
    const badge = resolveHomeCourseDiscoveryBadge(c("a"), {
      weeklyRankById: new Map(),
      editorPickIds: new Set(["a"]),
      statsByCourseId: new Map(),
    });
    expect(badge).toBeNull();
  });

  it("resolveHomeCourseDiscoveryBadge prioritizes weekly #1", () => {
    const id = "abc";
    const badge = resolveHomeCourseDiscoveryBadge(c(id), {
      weeklyRankById: new Map([[id, 1]]),
      statsByCourseId: new Map(),
    });
    expect(badge).toEqual({ emoji: "🔥", text: "이번주 1위" });
  });

  it("buildHomeCourseDiscoveryUnifiedList orders weekly before editor", () => {
    const stats = new Map([
      ["w", { recent_completion_count_7d: 5 }],
      ["e", { recent_completion_count_7d: 0 }],
    ]);
    const list = buildHomeCourseDiscoveryUnifiedList(
      [c("e")],
      [c("w")],
      stats,
      { limit: 2 }
    );
    expect(list.map((x) => x.course.id)).toEqual(["w", "e"]);
    expect(list[0].badge?.text).toBe("이번주 1위");
  });
});
