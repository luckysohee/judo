import { describe, expect, it } from "vitest";
import {
  detectPlacePeakSeasons,
  getSeasonalMenuMismatchPenalty,
  queryWantsSeasonalMenu,
} from "./placeSeasonality.js";

describe("placeSeasonality", () => {
  it("detects winter-peak from name and category", () => {
    expect(
      detectPlacePeakSeasons({
        name: "나는굴찜",
        category: "굴요리",
      })
    ).toEqual(["winter"]);
  });

  it("penalizes oyster place in summer for generic 을지로 search", () => {
    const place = { name: "나는굴찜", category: "굴요리" };
    const june = new Date("2026-06-15T12:00:00Z");
    expect(
      getSeasonalMenuMismatchPenalty(place, {
        rawQuery: "을지로 코스",
        parsedResult: { regions: ["을지로"] },
        now: june,
      })
    ).toBeLessThanOrEqual(-85);
  });

  it("does not penalize when user asks for seafood", () => {
    const place = { name: "나는굴찜", category: "굴요리" };
    const june = new Date("2026-06-15T12:00:00Z");
    expect(
      getSeasonalMenuMismatchPenalty(place, {
        rawQuery: "을지로 해산물",
        parsedResult: { foods: ["해산물"] },
        now: june,
      })
    ).toBe(0);
    expect(queryWantsSeasonalMenu("을지로 굴찜", {})).toBe(true);
  });
});
