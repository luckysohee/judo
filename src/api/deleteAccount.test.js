import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETE_TYPE_WORD,
  isAccountDeleteTyped,
} from "./deleteAccount.js";

describe("deleteAccount confirm", () => {
  it("accepts the exact withdrawal word", () => {
    expect(ACCOUNT_DELETE_TYPE_WORD).toBe("탈퇴");
    expect(isAccountDeleteTyped("탈퇴")).toBe(true);
    expect(isAccountDeleteTyped(" 탈퇴 ")).toBe(true);
    expect(isAccountDeleteTyped("삭제")).toBe(false);
    expect(isAccountDeleteTyped("")).toBe(false);
  });
});
