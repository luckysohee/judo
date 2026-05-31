import { describe, expect, it } from "vitest";
import {
  buildCuratorStyleWeightVectors,
  flattenCuratorStyleFeaturesForMl,
  normalizeCuratorStyleBlock,
  normalizeStyleDimensionRows,
} from "./curatorStyleFeatures";

describe("normalizeStyleDimensionRows", () => {
  it("parses count and pct", () => {
    expect(
      normalizeStyleDimensionRows([
        { label: "맥주", pct: 60, count: 3 },
        { label: "", pct: 10, count: 1 },
      ])
    ).toEqual([{ label: "맥주", pct: 60, count: 3 }]);
  });
});

describe("buildCuratorStyleWeightVectors", () => {
  it("normalizes from counts when present", () => {
    const style = normalizeCuratorStyleBlock({
      alcohol: [
        { label: "맥주", pct: 50, count: 2 },
        { label: "와인", pct: 50, count: 2 },
      ],
      moods: [],
      tags: [],
      categories: [],
      meta: { schema_version: 2 },
    });
    expect(buildCuratorStyleWeightVectors(style).alcohol).toEqual({
      맥주: 0.5,
      와인: 0.5,
    });
  });
});

describe("flattenCuratorStyleFeaturesForMl", () => {
  it("exports ML document shape", () => {
    const doc = flattenCuratorStyleFeaturesForMl(
      normalizeCuratorStyleBlock({
        alcohol: [{ label: "맥주", pct: 100, count: 1 }],
        moods: [],
        tags: [],
        categories: [],
        meta: {
          schema_version: 2,
          pick_source_count: 4,
          course_only_source_count: 1,
          theme_tag_source_count: 2,
        },
      })
    );
    expect(doc.schemaVersion).toBe(2);
    expect(doc.sources.pickPlaces).toBe(4);
    expect(doc.dimensions.alcohol[0].weight).toBe(1);
  });
});
