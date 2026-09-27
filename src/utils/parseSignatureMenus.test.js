import { describe, expect, it } from "vitest";
import {
  parseSignatureMenus,
  signatureMenusFromPlace,
} from "./parseSignatureMenus.js";

describe("parseSignatureMenus", () => {
  it("splits common delimiters and caps at 3", () => {
    expect(parseSignatureMenus("삼겹살, 냉면 · 소주안주 / 파전")).toEqual([
      "삼겹살",
      "냉면",
      "소주안주",
    ]);
  });

  it("returns empty for blank", () => {
    expect(parseSignatureMenus("")).toEqual([]);
    expect(parseSignatureMenus(null)).toEqual([]);
  });
});

describe("signatureMenusFromPlace", () => {
  it("prefers top-level recommended_menu", () => {
    expect(
      signatureMenusFromPlace({
        recommended_menu: "글라스와인",
        curatorPlaces: [{ recommended_menu: "안주세트" }],
      })
    ).toEqual(["글라스와인"]);
  });

  it("falls back to curatorPlaces", () => {
    expect(
      signatureMenusFromPlace({
        curatorPlaces: [{ recommended_menu: "모둠회, 소주" }],
      })
    ).toEqual(["모둠회", "소주"]);
  });
});
