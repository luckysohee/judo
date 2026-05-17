import { describe, expect, it } from "vitest";
import {
  enrichKakaoPlaceDocWithOgImage,
  extractOgImageUrlFromHtml,
} from "./kakaoPlaceOgImage.js";

describe("kakaoPlaceOgImage", () => {
  it("extractOgImageUrlFromHtml parses protocol-relative og:image", () => {
    const html =
      '<meta property="og:image" content="//img1.kakaocdn.net/cthumb/local/C800x400.q50/?fname=http%3A%2F%2Fexample.jpg">';
    expect(extractOgImageUrlFromHtml(html)).toBe(
      "https://img1.kakaocdn.net/cthumb/local/C800x400.q50/?fname=http%3A%2F%2Fexample.jpg"
    );
  });

  it("enrichKakaoPlaceDocWithOgImage adds thumbnail_url", async () => {
    const doc = { id: "123", place_name: "테스트" };
    const out = await enrichKakaoPlaceDocWithOgImage(doc, {
      fetchImpl: async () => ({
        ok: true,
        text: async () =>
          '<meta property="og:image" content="https://cdn.example/photo.jpg">',
      }),
    });
    expect(out.thumbnail_url).toBe("https://cdn.example/photo.jpg");
  });
});
