import { describe, expect, it } from "vitest";
import { buildKakaoPlaceOgStaticMapUrl } from "./kakaoStaticMapUrl";

describe("buildKakaoPlaceOgStaticMapUrl", () => {
  it("builds https og staticmap from wgs84", () => {
    const url = buildKakaoPlaceOgStaticMapUrl(37.4953, 127.064, 200);
    expect(url).toContain("https://staticmap.kakao.com/staticmap/og");
    expect(url).toContain("type=place");
    expect(url).toContain(encodeURIComponent("127.064,37.4953"));
  });

  it("returns null for invalid coords", () => {
    expect(buildKakaoPlaceOgStaticMapUrl(NaN, 127)).toBeNull();
  });
});
