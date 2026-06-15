import { describe, expect, it } from "vitest";
import {
  inferCasualDrinkMapIntentPhrase,
  stripPartyAndChatterForKeywordSearch,
} from "./searchParser.js";

describe("stripPartyAndChatterForKeywordSearch", () => {
  it("strips party size and casual drink phrasing", () => {
    expect(
      stripPartyAndChatterForKeywordSearch("친구 3명이서 성수에서 가볍게 한잔")
    ).toBe("성수");
  });
});

describe("inferCasualDrinkMapIntentPhrase", () => {
  it("maps light-drink phrasing to 술집", () => {
    expect(
      inferCasualDrinkMapIntentPhrase("친구 3명이서 성수에서 가볍게 한잔")
    ).toBe("술집");
    expect(inferCasualDrinkMapIntentPhrase("오늘 가볍게 한잔")).toBe("술집");
  });

  it("returns null for unrelated queries", () => {
    expect(inferCasualDrinkMapIntentPhrase("성수 노포")).toBe(null);
  });
});
