import { describe, expect, it } from "vitest";
import {
  dropProgressToNextCredit,
  formatDropBalance,
  formatDropEarnToast,
} from "./userWalletFormat.js";
import { DROPS_PER_AI_CREDIT } from "../constants/dropEconomy.js";

describe("userWalletFormat", () => {
  it("formatDropBalance", () => {
    expect(formatDropBalance(250)).toContain("250");
    expect(formatDropBalance(250)).toContain("Drop");
  });

  it("formatDropEarnToast", () => {
    expect(formatDropEarnToast(10)).toBe("+10 Drop");
  });

  it("dropProgressToNextCredit", () => {
    const p = dropProgressToNextCredit(17, DROPS_PER_AI_CREDIT);
    expect(p.current).toBe(2);
    expect(p.target).toBe(15);
  });
});
