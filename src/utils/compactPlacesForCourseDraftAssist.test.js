import { describe, expect, it } from "vitest";
import {
  compactPlacesForCourseDraftAssist,
  placeKeyForCourseDraftAssist,
} from "./compactPlacesForCourseDraftAssist.js";

describe("compactPlacesForCourseDraftAssist", () => {
  it("placeKey prefers UUID", () => {
    expect(
      placeKeyForCourseDraftAssist({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        name: "바",
      })
    ).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("placeKey uses kakao prefix for kakao hits", () => {
    expect(
      placeKeyForCourseDraftAssist({
        id: "kakao_12345",
        name: "빵집",
      })
    ).toBe("kakao_12345");
  });

  it("compact dedupes by placeKey", () => {
    const compact = compactPlacesForCourseDraftAssist([
      { id: "kakao_1", name: "A", category: "베이커리" },
      { id: "kakao_1", name: "A dup" },
      { id: "kakao_2", name: "B" },
    ]);
    expect(compact).toHaveLength(2);
    expect(compact[0].placeKey).toBe("kakao_1");
  });
});
