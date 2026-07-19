import { describe, expect, it } from "vitest";
import {
  expandListSearchQueryVariants,
  listMatchesDiscoverySearch,
} from "./listDiscoverySearch.js";

describe("listDiscoverySearch", () => {
  it("동 접미를 떼고 변형을 만든다", () => {
    const v = expandListSearchQueryVariants("성수동");
    expect(v).toContain("성수동");
    expect(v).toContain("성수");
  });

  it("성수 입력으로 성수동 지역 맛집첩이 잡힌다", () => {
    expect(
      listMatchesDiscoverySearch(
        { title: "저녁", area: "성수동", theme_tags: [], description: "" },
        "성수"
      )
    ).toBe(true);
  });

  it("태그·큐레이터·장소명을 본다", () => {
    const list = {
      title: "모음",
      area: "",
      theme_tags: ["이자카야"],
      description: "",
      _placeNames: ["우래옥"],
    };
    expect(
      listMatchesDiscoverySearch(list, "이자", { curatorLabel: "@kim" })
    ).toBe(true);
    expect(
      listMatchesDiscoverySearch(list, "우래", { curatorLabel: "@kim" })
    ).toBe(true);
    expect(
      listMatchesDiscoverySearch(list, "kim", { curatorLabel: "@kim" })
    ).toBe(true);
  });
});
