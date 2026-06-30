import { describe, expect, it } from "vitest";
import {
  buildCourseDiscoverySearchPlan,
  resolveCourseSearchAreaKey,
} from "./courseSearchAreaExpansion.js";
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
    // 성수 근처(약 4km 내)에는 압구정이 포함된다
    expect(plan.nearby.map((n) => n.key)).toContain("압구정");
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
});
