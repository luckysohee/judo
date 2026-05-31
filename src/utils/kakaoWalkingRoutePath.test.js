import { describe, expect, it } from "vitest";
import { pathFromKakaoWalkingRoute } from "./kakaoWalkingRoutePath.js";

describe("pathFromKakaoWalkingRoute", () => {
  it("flattens section roads vertexes in order and dedupes joints", () => {
    const path = pathFromKakaoWalkingRoute({
      result_code: 0,
      summary: { distance: 50, duration: 60 },
      sections: [
        {
          roads: [
            {
              vertexes: [126.991, 37.566, 126.992, 37.567],
            },
            {
              vertexes: [126.992, 37.567, 126.993, 37.568],
            },
          ],
        },
      ],
    });
    expect(path).toEqual([
      { lat: 37.566, lng: 126.991 },
      { lat: 37.567, lng: 126.992 },
      { lat: 37.568, lng: 126.993 },
    ]);
  });
});
