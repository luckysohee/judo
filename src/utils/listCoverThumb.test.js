import { describe, expect, it } from "vitest";
import { pickListDisplayCoverUrl } from "./listCoverThumb";

describe("pickListDisplayCoverUrl", () => {
  it("returns empty when missing", () => {
    expect(pickListDisplayCoverUrl(null)).toBe("");
    expect(pickListDisplayCoverUrl({})).toBe("");
    expect(pickListDisplayCoverUrl({ cover_image_url: "not-a-url" })).toBe("");
  });

  it("accepts http(s) cover urls", () => {
    expect(
      pickListDisplayCoverUrl({
        cover_image_url: "https://example.com/a.jpg",
      })
    ).toBe("https://example.com/a.jpg");
  });
});
