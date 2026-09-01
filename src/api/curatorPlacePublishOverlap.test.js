import { describe, expect, it } from "vitest";
import * as overlap from "./curatorPlacePublishOverlap.js";

describe("curatorPlacePublishOverlap API", () => {
  it("exports overlap helpers", () => {
    expect(typeof overlap.assessCuratorPlacePublishOverlap).toBe("function");
    expect(typeof overlap.confirmCuratorPlacePublishOverlapIfNeeded).toBe(
      "function"
    );
  });
});
