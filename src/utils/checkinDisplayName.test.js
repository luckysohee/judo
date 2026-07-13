import { describe, expect, it } from "vitest";
import {
  mergeCheckinProfileLabelRow,
  resolveCheckinDisplayName,
  resolveCheckinRowDisplayName,
  resolveProfilePublicLabel,
} from "./checkinDisplayName";

describe("checkinDisplayName", () => {
  it("resolveProfilePublicLabel prefers Studio 별명 (name) over profiles nick", () => {
    expect(
      resolveProfilePublicLabel({
        name: "노포킬러",
        username: "sulzzang",
        display_name: "mailprefix",
      })
    ).toBe("노포킬러");
  });

  it("resolveCheckinRowDisplayName uses curator 별명 over stored email local", () => {
    expect(
      resolveCheckinRowDisplayName(
        { user_id: "u1", user_nickname: "mailprefix" },
        {
          u1: mergeCheckinProfileLabelRow(
            { id: "u1", username: "sulzzang", display_name: "mailprefix" },
            { user_id: "u1", name: "노포킬러", slug: "sulzzang" }
          ),
        }
      )
    ).toBe("노포킬러");
  });

  it("resolveCheckinDisplayName prefers curator name when recording", () => {
    expect(
      resolveCheckinDisplayName(
        { id: "u1", user_metadata: {}, email: "a@b.com" },
        mergeCheckinProfileLabelRow(
          { username: "nightowl", display_name: "a" },
          { name: "김철수", username: "nightowl" }
        )
      )
    ).toBe("김철수");
  });

  it("falls back to profiles display_name when no curator 별명", () => {
    expect(
      resolveProfilePublicLabel({
        username: "nightowl",
        display_name: "홍길동",
      })
    ).toBe("홍길동");
  });

  it("falls back to handle when 별명 empty", () => {
    expect(
      resolveProfilePublicLabel({
        username: "nightowl",
        display_name: "",
      })
    ).toBe("nightowl");
  });
});
