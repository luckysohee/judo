import { describe, it, expect } from "vitest";
import {
  normalizeStudioPlaceCategory,
  STUDIO_PLACE_CATEGORY_OPTIONS,
  STUDIO_ATMOSPHERE_OPTIONS,
  COURSE_SECOND_VIBE_OPTIONS,
  mapStudioVibeToSecondFindBucket,
  mapStudioVibesToSecondFindDefaults,
  normalizeStudioAtmosphere,
  expandVibePrefTokens,
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

describe("잔 올리기·2차 찾기 공통 분위기", () => {
  it("Studio와 2차 칩이 동일", () => {
    expect(COURSE_SECOND_VIBE_OPTIONS).toEqual(STUDIO_ATMOSPHERE_OPTIONS);
    expect(STUDIO_ATMOSPHERE_OPTIONS).toEqual([
      "활기찬",
      "모던함",
      "조용한",
      "편안한",
      "힙한",
    ]);
  });

  it("maps 시끄러운→활기찬, 세련된/모던한→모던함, 힙→힙한", () => {
    expect(mapStudioVibeToSecondFindBucket("시끄러운")).toBe("활기찬");
    expect(mapStudioVibeToSecondFindBucket("세련된")).toBe("모던함");
    expect(mapStudioVibeToSecondFindBucket("모던한")).toBe("모던함");
    expect(mapStudioVibeToSecondFindBucket("힙한")).toBe("힙한");
    expect(normalizeStudioAtmosphere("힙플레이스")).toBe("힙한");
  });

  it("dedupes taste defaults into buckets", () => {
    expect(
      mapStudioVibesToSecondFindDefaults(["시끄러운", "활기찬", "세련된", "힙한"])
    ).toEqual(["활기찬", "모던함"]);
  });

  it("expandVibePrefTokens: 활기찬·모던함·힙한", () => {
    const lively = expandVibePrefTokens("활기찬");
    expect(lively).toContain("시끄러운");
    expect(lively).toContain("활기찬");
    const modern = expandVibePrefTokens("모던함");
    expect(modern).toContain("세련된");
    expect(modern).toContain("모던한");
    expect(modern).not.toContain("힙");
    const hip = expandVibePrefTokens("힙한");
    expect(hip).toContain("힙");
    expect(hip).toContain("트렌디");
  });
});
