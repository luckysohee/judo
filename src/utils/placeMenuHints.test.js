import { describe, expect, it } from "vitest";
import { collectPlaceMenuHints } from "./placeMenuHints.js";

describe("collectPlaceMenuHints", () => {
  it("큐레이터 추천 메뉴·블로그 메뉴를 모은다", () => {
    const out = collectPlaceMenuHints({
      recommended_menu: "막걸리, 빈대떡",
      curatorPlaces: [
        {
          recommended_menu: "파전",
          menu_reason: "해물파전 추천해요 정말 맛있음",
        },
        {
          menu_reason:
            "저녁에 꼭 시켜 먹어야 하는 메뉴가 있는데 바로 이 집 해물파전입니다",
        },
      ],
      blogInsight: { menu: ["모둠전", "막걸리"] },
    });
    expect(out.items).toEqual(
      expect.arrayContaining(["막걸리", "빈대떡", "파전", "모둠전", "해물파전 추천해요 정말 맛있음"])
    );
    expect(out.notes.some((n) => /해물파전/.test(n))).toBe(true);
    expect(out.hasAny).toBe(true);
  });

  it("빈 장소는 hasAny false", () => {
    expect(collectPlaceMenuHints({}).hasAny).toBe(false);
  });
});
