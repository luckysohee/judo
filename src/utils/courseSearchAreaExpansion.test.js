import { describe, expect, it } from "vitest";
import {
  buildCourseDiscoverySearchPlan,
  resolveCourseSearchAreaKey,
} from "./courseSearchAreaExpansion.js";
import { parseCourseQuery } from "./parseCourseQuery.js";
import { getNearbyRegionKeys } from "./searchParser.js";

describe("resolveCourseSearchAreaKey", () => {
  it("성수동·성수역을 성수 클러스터로 정규화한다", () => {
    expect(resolveCourseSearchAreaKey("성수동")).toBe("성수");
    expect(resolveCourseSearchAreaKey("성수역 데이트")).toBe("성수");
    expect(resolveCourseSearchAreaKey("성수")).toBe("성수");
  });

  it("을지로입구·을지로3가도 을지로로 묶는다", () => {
    expect(resolveCourseSearchAreaKey("을지로입구")).toBe("을지로");
  });

  it("서울숲·뚝섬·건대를 각각 독립 클러스터로 인식한다", () => {
    expect(resolveCourseSearchAreaKey("서울숲")).toBe("서울숲");
    expect(resolveCourseSearchAreaKey("뚝섬역")).toBe("뚝섬");
    expect(resolveCourseSearchAreaKey("건대입구")).toBe("건대");
  });

  it("지역이 없으면 null", () => {
    expect(resolveCourseSearchAreaKey("분위기 좋은 와인바")).toBeNull();
    expect(resolveCourseSearchAreaKey("")).toBeNull();
  });
});

describe("buildCourseDiscoverySearchPlan", () => {
  it("성수동 검색은 primaryQuery를 성수로 정규화한다", () => {
    const plan = buildCourseDiscoverySearchPlan("성수동");
    expect(plan.areaKey).toBe("성수");
    expect(plan.primaryQuery).toBe("성수");
  });

  it("동네명이 섞인 쿼리도 토큰만 정규화한다", () => {
    const plan = buildCourseDiscoverySearchPlan("성수동 데이트");
    expect(plan.areaKey).toBe("성수");
    expect(plan.primaryQuery).toContain("성수");
    expect(plan.primaryQuery).not.toContain("성수동");
  });

  it("인접 지역을 근처 묶음으로 제안한다(자기 자신 제외)", () => {
    const plan = buildCourseDiscoverySearchPlan("성수동");
    expect(Array.isArray(plan.nearby)).toBe(true);
    expect(plan.nearby.every((n) => n.key !== "성수")).toBe(true);
    // 성수 바로 옆(뚝섬·서울숲·건대)이 압구정보다 가까움
    const keys = plan.nearby.map((n) => n.key);
    expect(keys.some((k) => /뚝섬|서울숲|건대/.test(k))).toBe(true);
  });

  it("지역이 없으면 원문 그대로, 근처 없음", () => {
    const plan = buildCourseDiscoverySearchPlan("조용한 바");
    expect(plan.areaKey).toBeNull();
    expect(plan.primaryQuery).toBe("조용한 바");
    expect(plan.nearby).toEqual([]);
  });
});

describe("getNearbyRegionKeys", () => {
  it("거리순으로 인접 클러스터를 반환하고 자기 자신은 뺀다", () => {
    const near = getNearbyRegionKeys("강남", { maxKm: 4, limit: 3 });
    expect(near).not.toContain("강남");
    expect(near.length).toBeLessThanOrEqual(3);
  });

  it("성수 검색 시 뚝섬·서울숲·건대가 근처 후보에 포함된다", () => {
    const near = getNearbyRegionKeys("성수", { maxKm: 4, limit: 5 });
    expect(near.some((k) => /뚝섬|서울숲|건대/.test(k))).toBe(true);
  });
});

describe("parseCourseQuery 성수 인접 권역", () => {
  it("코스 생성은 서울숲·뚝섬을 성수 풀로 합치고 건대는 독립", () => {
    expect(parseCourseQuery("서울숲 데이트 코스").area).toBe("성수");
    expect(parseCourseQuery("뚝섬 데이트 코스").area).toBe("성수");
    expect(parseCourseQuery("건대 데이트 코스").area).toBe("건대");
  });
});
