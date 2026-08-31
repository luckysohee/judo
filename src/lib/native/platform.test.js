import { describe, expect, it } from "vitest";
import { isNativePlatform, getNativePlatform } from "./platform";

describe("native platform helpers", () => {
  it("reports web in jsdom / vite test", () => {
    expect(isNativePlatform()).toBe(false);
    expect(getNativePlatform()).toBe("web");
  });
});
