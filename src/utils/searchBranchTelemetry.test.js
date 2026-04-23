import { describe, expect, it } from "vitest";
import { shouldPreferFallbackSearchResults } from "./searchBranchTelemetry.js";

describe("shouldPreferFallbackSearchResults", () => {
  it("prefers strictly longer list when quality does not degrade", () => {
    const pre = [
      { aiScore: 10 },
      { aiScore: 8 },
    ];
    const post = [
      { aiScore: 10 },
      { aiScore: 8 },
      { aiScore: 9 },
    ];
    expect(shouldPreferFallbackSearchResults(pre, post)).toBe(true);
  });

  it("rejects longer list when top-N average score drops", () => {
    const pre = [
      { aiScore: 10 },
      { aiScore: 9 },
    ];
    const post = [
      { aiScore: 2 },
      { aiScore: 2 },
      { aiScore: 2 },
    ];
    expect(shouldPreferFallbackSearchResults(pre, post)).toBe(false);
  });

  it("accepts from empty pre when post has rows", () => {
    expect(shouldPreferFallbackSearchResults([], [{ aiScore: 1 }])).toBe(true);
  });

  it("rejects same or shorter length", () => {
    expect(
      shouldPreferFallbackSearchResults([{ aiScore: 5 }], [{ aiScore: 99 }])
    ).toBe(false);
  });

  it("rejects empty post", () => {
    expect(shouldPreferFallbackSearchResults([{ aiScore: 1 }], [])).toBe(
      false
    );
  });
});
