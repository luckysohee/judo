import { describe, expect, it } from "vitest";
import { normalizeHitForPlaceEnsure } from "./prepareCourseEditorPlaceRow.js";

describe("normalizeHitForPlaceEnsure", () => {
  it("maps kakao doc to ensure payload", () => {
    expect(
      normalizeHitForPlaceEnsure({
        id: "kakao_99",
        name: "빵집",
        _kakaoDoc: {
          id: "99",
          place_name: "빵집",
          y: "37.5",
          x: "127.0",
        },
      })
    ).toMatchObject({
      kakao_place_id: "99",
      y: "37.5",
      x: "127.0",
    });
  });

  it("unwraps kakao_ id prefix", () => {
    expect(
      normalizeHitForPlaceEnsure({ id: "kakao_12345", name: "바" })
    ).toMatchObject({
      id: "12345",
      kakao_place_id: "12345",
    });
  });
});
