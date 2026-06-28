import { describe, expect, it } from "vitest";
import {
  aggregateSearchTasteSignals,
  searchSignalsHaveEnough,
} from "./userSearchTasteSignals.js";

describe("userSearchTasteSignals", () => {
  it("aggregates parsed fields by frequency", () => {
    const rows = [
      { user_query: "성수 와인", parsed_region: "성수", parsed_alcohol: "와인", parsed_vibe: "조용한" },
      { user_query: "성수 데이트", parsed_region: "성수", parsed_alcohol: "와인", parsed_vibe: null },
      { user_query: "연남 맥주", parsed_region: "연남", parsed_alcohol: "맥주", parsed_vibe: "시끌" },
    ];
    const s = aggregateSearchTasteSignals(rows);
    expect(s.totalSearches).toBe(3);
    expect(s.regions[0]).toEqual({ value: "성수", count: 2 });
    expect(s.liquor[0]).toEqual({ value: "와인", count: 2 });
    expect(s.regions.map((r) => r.value)).toContain("연남");
  });

  it("ignores empty/null values", () => {
    const s = aggregateSearchTasteSignals([
      { user_query: "  ", parsed_region: "", parsed_alcohol: null },
      { user_query: "성수", parsed_region: "성수" },
    ]);
    expect(s.regions).toEqual([{ value: "성수", count: 1 }]);
    expect(s.liquor).toEqual([]);
  });

  it("requires enough searches and at least one signal", () => {
    const weak = aggregateSearchTasteSignals([
      { parsed_region: "성수" },
      { parsed_region: "성수" },
    ]);
    expect(searchSignalsHaveEnough(weak, { minSearches: 4 })).toBe(false);

    const strong = aggregateSearchTasteSignals([
      { parsed_region: "성수" },
      { parsed_region: "성수" },
      { parsed_alcohol: "와인" },
      { parsed_vibe: "조용한" },
    ]);
    expect(searchSignalsHaveEnough(strong, { minSearches: 4 })).toBe(true);
    expect(searchSignalsHaveEnough(null)).toBe(false);
  });

  it("handles non-array input", () => {
    const s = aggregateSearchTasteSignals(null);
    expect(s.totalSearches).toBe(0);
    expect(s.regions).toEqual([]);
  });
});
