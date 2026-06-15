import { describe, expect, it } from "vitest";
import { createRandomUuid, isUuidV4String } from "./createRandomUuid";

describe("createRandomUuid", () => {
  it("returns a valid UUID v4 string", () => {
    const id = createRandomUuid();
    expect(typeof id).toBe("string");
    expect(isUuidV4String(id)).toBe(true);
  });

  it("returns distinct values", () => {
    expect(createRandomUuid()).not.toBe(createRandomUuid());
  });

  it("fallback without randomUUID still returns UUID v4", () => {
    const orig = globalThis.crypto?.randomUUID;
    if (globalThis.crypto) {
      try {
        Object.defineProperty(globalThis.crypto, "randomUUID", {
          configurable: true,
          value: undefined,
        });
      } catch {
        return;
      }
    }
    const id = createRandomUuid();
    expect(isUuidV4String(id)).toBe(true);
    if (globalThis.crypto && orig) {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: orig,
      });
    }
  });
});
