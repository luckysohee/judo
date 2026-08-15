import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETE_CONFIRM_TOKEN } from "./accountDelete.js";

describe("account delete confirm", () => {
  it("uses a non-guessable client-facing token", () => {
    expect(ACCOUNT_DELETE_CONFIRM_TOKEN).toBe("DELETE");
  });
});
