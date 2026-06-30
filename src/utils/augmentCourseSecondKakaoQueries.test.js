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
});
