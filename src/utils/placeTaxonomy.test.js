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
  anjuExpandedTokenMatchesHaystack,
  placeLooksLikeBunsik,
  placeLooksLikeSeafoodAnju,
  placeLooksLikeGukmulAnju,
  expandAnjuHintTokens,
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

describe("안주 토큰 매칭", () => {
  it("짧은 «식»이 «해산물»에 포함돼 오탐하지 않음", () => {
    expect(anjuExpandedTokenMatchesHaystack("식", "해산물")).toBe(false);
    expect(anjuExpandedTokenMatchesHaystack("분식", "해산물")).toBe(false);
    expect(anjuExpandedTokenMatchesHaystack("해산물", "해산물")).toBe(true);
    expect(anjuExpandedTokenMatchesHaystack("횟집", "횟집")).toBe(true);
  });

  it("분식은 해산물 안주와 충돌, 횟집은 맞음", () => {
    expect(
      placeLooksLikeBunsik({
        name: "신당동 떡볶이",
        category_name: "음식점 > 분식",
      })
    ).toBe(true);
    expect(
      placeLooksLikeSeafoodAnju({
        name: "신당동 떡볶이",
        category_name: "음식점 > 분식",
      })
    ).toBe(false);
    expect(
      placeLooksLikeSeafoodAnju({
        name: "성수 횟집",
        category_name: "음식점 > 해산물 > 회",
      })
    ).toBe(true);
  });

  it("플래터 칩은 치즈·와인바·타파스까지 확장", () => {
    const tokens = expandAnjuHintTokens("플래터");
    expect(tokens).toContain("치즈플래터");
    expect(tokens).toContain("와인바");
    expect(tokens).toContain("타파스");
    expect(expandAnjuHintTokens("치즈")).toEqual(tokens);
  });

  it("국물은 라면·순대 분식 토큰 없이 탕·복어·전골 위주", () => {
    const tokens = expandAnjuHintTokens("국물");
    expect(tokens).not.toContain("라면");
    expect(tokens).not.toContain("순대");
    expect(tokens).not.toContain("탕");
    expect(tokens).toContain("국밥");
    expect(tokens).toContain("전골");
    expect(tokens).toContain("복어");
    expect(tokens).toContain("순대국");
  });

  it("국물 신호: 국밥·복어는 맞고 분식은 아님", () => {
    expect(
      placeLooksLikeGukmulAnju({
        name: "성수 순대국밥",
        category_name: "음식점 > 한식 > 국밥",
      })
    ).toBe(true);
    expect(
      placeLooksLikeGukmulAnju({
        name: "복어전문점",
        category_name: "음식점 > 한식 > 복어",
      })
    ).toBe(true);
    expect(
      placeLooksLikeGukmulAnju({
        name: "신당동 떡볶이",
        category_name: "음식점 > 분식",
      })
    ).toBe(false);
  });
});
