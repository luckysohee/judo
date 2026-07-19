import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  detectInAppBrowser,
  isInAppBrowser,
  openCurrentPageInExternalBrowser,
} from "./inAppBrowser";

describe("detectInAppBrowser", () => {
  const originalUa = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: originalUa,
      configurable: true,
    });
  });

  it("detects KakaoTalk in-app", () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 KAKAOTALK",
      configurable: true,
    });
    expect(detectInAppBrowser()?.id).toBe("kakaotalk");
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns null for Chrome mobile", () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      configurable: true,
    });
    expect(detectInAppBrowser()).toBeNull();
  });
});

describe("openCurrentPageInExternalBrowser", () => {
  it("uses Chrome intent on Android", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 14) KAKAOTALK",
      configurable: true,
    });
    const loc = { href: "https://judo.example/path?q=1" };
    vi.stubGlobal("window", { location: loc });
    // openCurrentPage uses window.location + navigator
    const result = openCurrentPageInExternalBrowser();
    expect(result).toBe("android_chrome");
    expect(String(loc.href)).toContain("intent://");
    expect(String(loc.href)).toContain("com.android.chrome");
    vi.unstubAllGlobals();
  });
});
