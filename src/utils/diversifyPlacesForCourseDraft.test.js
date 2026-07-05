import { describe, expect, it } from "vitest";
import {
  categoryBucketForPlace,
  diversifyPlacesForCourseDraft,
  diversityHintForVariant,
} from "./diversifyPlacesForCourseDraft.js";

describe("diversifyPlacesForCourseDraft", () => {
  it("categoryBucketForPlace detects bakery", () => {
    expect(categoryBucketForPlace({ category: "베이커리" })).toBe("bakery");
  });

  it("variant seed changes order", () => {
    const places = Array.from({ length: 12 }, (_, i) => ({
      id: `kakao_${i}`,
      name: `Place ${i}`,
      category: i % 3 === 0 ? "베이커리" : i % 3 === 1 ? "카페" : "음식점",
    }));
    const a = diversifyPlacesForCourseDraft(places, {
      query: "성수 빵",
      variantSeed: 0,
    }).map((p) => p.id);
    const b = diversifyPlacesForCourseDraft(places, {
      query: "성수 빵",
      variantSeed: 3,
    }).map((p) => p.id);
    expect(a.length).toBe(12);
    expect(b.length).toBe(12);
    expect(a.join(",")).not.toBe(b.join(","));
  });

  it("diversityHintForVariant rotates", () => {
    expect(diversityHintForVariant(0)).not.toBe(diversityHintForVariant(1));
  });

  it("preferHiddenGems deprioritizes low rank (famous) kakao places", () => {
    const places = Array.from({ length: 8 }, (_, i) => ({
      id: `kakao_${i}`,
      name: `Place ${i}`,
      category: "카페",
      _popularityRank: i,
    }));
    const normal = diversifyPlacesForCourseDraft(places, {
      query: "test",
      variantSeed: 0,
      preferHiddenGems: false,
    });
    const hidden = diversifyPlacesForCourseDraft(places, {
      query: "test",
      variantSeed: 0,
      preferHiddenGems: true,
    });
    const avgRank = (arr) =>
      arr.reduce((s, p) => s + (p._popularityRank ?? 0), 0) / arr.length;
    expect(avgRank(hidden.slice(0, 4))).toBeGreaterThan(
      avgRank(normal.slice(0, 4))
    );
  });

  it("preferCuratorPicks puts curator picks near front", () => {
    const places = [
      { id: "kakao_1", name: "A", category: "카페", _popularityRank: 0 },
      { id: "kakao_2", name: "B", category: "카페", _popularityRank: 1 },
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "My pick",
        category: "베이커리",
        isCuratorPick: true,
      },
    ];
    const out = diversifyPlacesForCourseDraft(places, {
      query: "test",
      variantSeed: 0,
      preferCuratorPicks: true,
    });
    expect(out[0]?.isCuratorPick).toBe(true);
  });
});
