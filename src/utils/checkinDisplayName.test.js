import { describe, expect, it } from "vitest";
import {
  resolveCheckinDisplayName,
  resolveCheckinRowDisplayName,
  resolveProfilePublicLabel,
} from "./checkinDisplayName";

describe("checkinDisplayName", () => {
  it("resolveProfilePublicLabel prefers username handle", () => {
    expect(
      resolveProfilePublicLabel({
        username: "sulzzang",
        display_name: "홍길동",
      })
    ).toBe("sulzzang");
  });

  it("resolveCheckinRowDisplayName uses profile handle over stored nickname", () => {
    expect(
      resolveCheckinRowDisplayName(
        { user_id: "u1", user_nickname: "홍길동" },
        { u1: { username: "sulzzang", display_name: "홍길동" } }
      )
    ).toBe("sulzzang");
  });

  it("resolveCheckinDisplayName prefers username when recording check-in", () => {
    expect(
      resolveCheckinDisplayName(
        { id: "u1", user_metadata: {}, email: "a@b.com" },
        { username: "nightowl", display_name: "김철수" }
      )
    ).toBe("nightowl");
  });
});
