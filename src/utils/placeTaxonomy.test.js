import { describe, it, expect } from "vitest";
import {
  normalizeStudioPlaceCategory,
  STUDIO_PLACE_CATEGORY_OPTIONS,
} from "./placeTaxonomy.js";

describe("normalizeStudioPlaceCategory", () => {
  it("passes through canonical options", () => {
    for (const c of STUDIO_PLACE_CATEGORY_OPTIONS) {
      expect(normalizeStudioPlaceCategory(c)).toBe(c);
    }
  });

  it("maps Kakao-style hierarchy to 술집·바", () => {
    expect(
      normalizeStudioPlaceCategory("음식점 > 술집 > 실내포장마차")
    ).toBe("술집·바");
  });

  it("maps meat dish labels to 육류", () => {
    expect(normalizeStudioPlaceCategory("돼지고기구이")).toBe("육류");
  });

  it("maps empty to 미분류", () => {
    expect(normalizeStudioPlaceCategory("")).toBe("미분류");
    expect(normalizeStudioPlaceCategory(null)).toBe("미분류");
  });
});
