import { describe, expect, it } from "vitest";
import {
  PRIVACY_POLICY_META,
  PRIVACY_POLICY_SECTIONS,
} from "./privacyPolicySections.js";

describe("privacyPolicySections", () => {
  it("has a title and account-deletion guidance", () => {
    expect(PRIVACY_POLICY_META.title).toBe("개인정보 처리방침");
    const joined = PRIVACY_POLICY_SECTIONS.flatMap((s) => [
      ...(s.body || []),
      ...(s.list || []),
    ]).join("\n");
    expect(joined).toContain("/account");
    expect(joined).toContain("위치");
  });
});
