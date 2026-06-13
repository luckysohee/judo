import { describe, it, expect } from "vitest";
import {
  expandFoodKakaoQueries,
  filterPlacesByNopoFocus,
  kakaoMapSearchWantsBroadPlaceCategories,
  queryWantsNopoFoodFocus,
} from "./searchParser.js";

describe("노포 검색", () => {
  it("expandFoodKakaoQueries — 주점·호프로 넓히지 않음", () => {
    const qs = expandFoodKakaoQueries("강남구 노포");
    expect(qs).toContain("강남구 노포");
    expect(qs.some((q) => /주점|호프|유흥/.test(q))).toBe(false);
    expect(qs.some((q) => /한식|국밥|음식점/.test(q))).toBe(true);
  });

  it("노포 검색은 FD6 음식점 카테고리 유지", () => {
    expect(kakaoMapSearchWantsBroadPlaceCategories("강남구 노포")).toBe(false);
    expect(kakaoMapSearchWantsBroadPlaceCategories("을지로 술집")).toBe(true);
  });

  it("filterPlacesByNopoFocus — 유흥·노래주점 제거", () => {
    const rows = [
      { place_name: "강남유흥주점", category_name: "유흥주점" },
      { place_name: "샤론노래주점", category_name: "노래방" },
      { place_name: "할매국밥", category_name: "한식>국밥" },
    ];
    const kept = filterPlacesByNopoFocus(rows);
    expect(kept.map((p) => p.place_name)).toEqual(["할매국밥"]);
  });

  it("queryWantsNopoFoodFocus", () => {
    expect(queryWantsNopoFoodFocus("강남구 노포", null)).toBe(true);
    expect(queryWantsNopoFoodFocus("강남 와인바", null)).toBe(false);
  });
});
