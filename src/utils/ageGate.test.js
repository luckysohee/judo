import { beforeEach, describe, expect, it } from "vitest";
import {
  AGE_GATE_STORAGE_KEY,
  isAgeConfirmed,
  isAgeGatePublicPath,
  markAgeConfirmed,
  resetAgeGateForTests,
} from "./ageGate";

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  resetAgeGateForTests();
});

describe("ageGate", () => {
  it("allows terms and privacy without confirmation", () => {
    expect(isAgeGatePublicPath("/terms")).toBe(true);
    expect(isAgeGatePublicPath("/privacy")).toBe(true);
    expect(isAgeGatePublicPath("/privacy/extra")).toBe(true);
    expect(isAgeGatePublicPath("/")).toBe(false);
    expect(isAgeGatePublicPath("/saved")).toBe(false);
  });

  it("persists confirmation", () => {
    expect(isAgeConfirmed()).toBe(false);
    markAgeConfirmed();
    expect(isAgeConfirmed()).toBe(true);
    expect(localStorage.getItem(AGE_GATE_STORAGE_KEY)).toBe("1");
  });
});
