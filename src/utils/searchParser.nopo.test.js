import { describe, it, expect } from "vitest";
import {
  expandFoodKakaoQueries,
  filterPlacesByNopoFocus,
  kakaoMapSearchWantsBroadPlaceCategories,
  queryWantsNopoFoodFocus,
} from "./searchParser.js";
import { scoreNopoSignals } from "./nopoSearchProfile.js";

describe("노포 검색", () => {
  it("expandFoodKakaoQueries — 골목·포장마차·호프 포함, 유흥 키워드 없음", () => {
    const qs = expandFoodKakaoQueries("강남구 노포");
    expect(qs).toContain("강남구 노포");
    expect(qs.some((q) => /골목|포장마차|호프/.test(q))).toBe(true);
    expect(qs.some((q) => /유흥|노래/.test(q))).toBe(false);
  });

  it("노포 검색은 broad 카테고리(술집 후보) + 필터로 정리", () => {
    expect(kakaoMapSearchWantsBroadPlaceCategories("강남구 노포")).toBe(true);
    expect(kakaoMapSearchWantsBroadPlaceCategories("을지로 술집")).toBe(true);
  });

  it("filterPlacesByNopoFocus — 유흥·비업소 제거, 노포 신호 우선", () => {
    const rows = [
      { place_name: "강남유흥주점", category_name: "유흥주점" },
      { place_name: "샤론노래주점", category_name: "노래방" },
      { place_name: "골목식당노무", category_name: "법률,행정" },
      { place_name: "할매국밥", category_name: "한식>국밥" },
      { place_name: "골목 포장마차", category_name: "포장마차" },
    ];
    const kept = filterPlacesByNopoFocus(rows);
    expect(kept.map((p) => p.place_name)).not.toContain("강남유흥주점");
    expect(kept.map((p) => p.place_name)).not.toContain("샤론노래주점");
    expect(kept.map((p) => p.place_name)).not.toContain("골목식당노무");
    expect(kept.map((p) => p.place_name)).toContain("할매국밥");
    expect(kept.map((p) => p.place_name)).toContain("골목 포장마차");
  });

  it("scoreNopoSignals — 체인 브랜드 제외 (프릳츠·깔리)", () => {
    for (const row of [
      { place_name: "프릳츠 커피", category_name: "카페>커피전문점" },
      { place_name: "깔리 테이블", category_name: "양식>브런치" },
      { place_name: "스타벅스 강남역점", category_name: "카페>커피전문점" },
    ]) {
      const s = scoreNopoSignals(row);
      expect(s.disallowed).toBe(true);
      expect(s.signals).toContain("chain");
    }
  });

  it("scoreNopoSignals — 노가리체인은 메뉴명이라 체인으로 안 봄", () => {
    const s = scoreNopoSignals({
      place_name: "원조만선호프 노가리체인본점",
      category_name: "한식>호프,요리주점",
      tags: ["노포"],
    });
    expect(s.disallowed).toBe(false);
    expect(s.signals).not.toContain("chain");
  });

  it("scoreNopoSignals — 체인이어도 큐레이터 노포 태그면 예외", () => {
    const s = scoreNopoSignals({
      place_name: "프릳츠 커피",
      category_name: "카페>커피전문점",
      tags: ["노포"],
    });
    expect(s.disallowed).toBe(false);
    expect(s.signals).toContain("chain_curator_exception");
  });

  it("scoreNopoSignals — 법률·행정 카테고리는 상호에 식당이 있어도 제외", () => {
    const s = scoreNopoSignals({
      place_name: "골목식당노무",
      category_name: "법률,행정",
    });
    expect(s.disallowed).toBe(true);
    expect(s.signals).toContain("non_venue_category");
  });

  it("scoreNopoSignals — 분위기만으로도 점수", () => {
    const s = scoreNopoSignals({
      place_name: "골목 이자카야",
      category_name: "이자카야",
      tags: ["노포감성"],
    });
    expect(s.disallowed).toBe(false);
    expect(s.score).toBeGreaterThan(2);
  });

  it("scoreNopoSignals — 심야식당은 노포로 안 봄", () => {
    const s = scoreNopoSignals({
      place_name: "백수씨심야식당",
      category_name: "술집 > 호프",
    });
    expect(s.score).toBeLessThan(2);
    expect(s.signals).toContain("modern_false_positive");
  });

  it("scoreNopoSignals — 육회관포차 을지로점 같은 분점·신생 체인은 제외", () => {
    const s = scoreNopoSignals({
      place_name: "육회관포차 을지로점",
      category_name: "술집 > 포장마차",
    });
    expect(s.disallowed).toBe(true);
    expect(s.signals).toContain("chain");
    expect(s.signals).toContain("multi_branch");
  });

  it("scoreNopoSignals — 을밀대·우래옥 본점은 분점으로 오인하지 않음", () => {
    for (const name of ["을밀대 본점", "우래옥 본점", "평양면옥 본점"]) {
      const s = scoreNopoSignals({
        place_name: name,
        category_name: "음식점 > 한식 > 국수",
      });
      expect(s.disallowed).toBe(false);
      expect(s.signals).not.toContain("multi_branch");
      expect(s.score).toBeGreaterThanOrEqual(3);
    }
  });

  it("scoreNopoSignals — 1호점만으로 역사 점수 주지 않음", () => {
    const s = scoreNopoSignals({
      place_name: "다시열린하얀집 1호점",
      category_name: "한식",
    });
    expect(s.signals).not.toContain("history");
  });

  it("scoreNopoSignals — 카테고리 포장마차만으로는 노포 분위기 점수 없음", () => {
    const s = scoreNopoSignals({
      place_name: "아무포차",
      category_name: "술집 > 포장마차",
    });
    expect(s.signals).not.toContain("atmosphere");
    expect(s.score).toBeLessThan(3);
  });

  it("scoreNopoSignals — 상호에 골목·포장마차가 있으면 분위기 인정", () => {
    const s = scoreNopoSignals({
      place_name: "골목 포장마차",
      category_name: "포장마차",
    });
    expect(s.disallowed).toBe(false);
    expect(s.score).toBeGreaterThanOrEqual(3);
  });

  it("queryWantsNopoFoodFocus", () => {
    expect(queryWantsNopoFoodFocus("강남구 노포", null)).toBe(true);
    expect(queryWantsNopoFoodFocus("강남 와인바", null)).toBe(false);
  });
});
