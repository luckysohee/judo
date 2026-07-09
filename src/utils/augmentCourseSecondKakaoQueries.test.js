import { describe, expect, it } from "vitest";
import {
  buildCourseSecondKakaoQueries,
  VIBE_CHIP_WINE_SECOND_KAKAO_QUERIES,
} from "./augmentCourseSecondPlacesWithKakao.js";

describe("buildCourseSecondKakaoQueries", () => {
  it("와인 주종 선택 시 분위기 칩 와인바 키워드를 포함한다", () => {
    const q = buildCourseSecondKakaoQueries({ liquorTypes: ["와인"] });
    expect(q).toContain("와인바");
    expect(q).toContain("칵테일바");
    expect(VIBE_CHIP_WINE_SECOND_KAKAO_QUERIES.every((k) => q.includes(k))).toBe(
      true
    );
  });

  it("vibeChipFallback이면 와인 칩 키워드만 쓴다", () => {
    const q = buildCourseSecondKakaoQueries({
      liquorTypes: ["와인"],
      vibeChipFallback: true,
    });
    expect(q).toEqual(VIBE_CHIP_WINE_SECOND_KAKAO_QUERIES);
    expect(q).not.toContain("포장마차");
  });

  it("고량주 주종은 중식·중국집 키워드를 풀에 넣는다", () => {
    const q = buildCourseSecondKakaoQueries({ liquorTypes: ["고량주"] });
    expect(q).toContain("중식당");
    expect(q).toContain("중국집");
  });

  it("막걸리·전통주 주종은 모던 한식·전통 주점 키워드를 풀에 넣는다", () => {
    const q = buildCourseSecondKakaoQueries({ liquorTypes: ["막걸리", "전통주"] });
    expect(q).toContain("모던한식");
    expect(q.some((k) => /전집|전통주점|한식주점/.test(k))).toBe(true);
  });

  it("위스키 주종은 위스키 전용 키워드만 쓰고 일반 바·라운지는 넣지 않는다", () => {
    const q = buildCourseSecondKakaoQueries({ liquorTypes: ["위스키"] });
    expect(q).toContain("위스키바");
    expect(q).toContain("위스키");
    expect(q).not.toContain("바");
    expect(q).not.toContain("라운지");
  });

  it("whiskeyChipFallback이면 위스키 전용 키워드만 쓴다", () => {
    const q = buildCourseSecondKakaoQueries({
      liquorTypes: ["위스키"],
      whiskeyChipFallback: true,
    });
    expect(q.every((k) => /위스키|싱글몰트/.test(k))).toBe(true);
    expect(q).not.toContain("포장마차");
  });
});
