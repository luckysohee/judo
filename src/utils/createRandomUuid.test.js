import { describe, expect, it } from "vitest";
import { createRandomUuid } from "./createRandomUuid";

describe("createRandomUuid", () => {
  it("returns a non-empty string", () => {
    const id = createRandomUuid();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(8);
  });

  it("returns distinct values", () => {
    expect(createRandomUuid()).not.toBe(createRandomUuid());
  });
});
