import { afterEach, describe, expect, it, vi } from "vitest";
import { rewriteLegacySupabaseStorageUrl } from "./rewriteLegacySupabaseStorageUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rewriteLegacySupabaseStorageUrl", () => {
  it("rewrites legacy mumbai host to current project", () => {
    vi.stubEnv(
      "VITE_SUPABASE_URL",
      "https://myawdyvnecwpolddswus.supabase.co"
    );
    expect(
      rewriteLegacySupabaseStorageUrl(
        "https://juordxxsjecjmgmbnzox.supabase.co/storage/v1/object/public/curator-photos/a.jpg"
      )
    ).toBe(
      "https://myawdyvnecwpolddswus.supabase.co/storage/v1/object/public/curator-photos/a.jpg"
    );
  });

  it("upgrades kakao staticmap http to https", () => {
    expect(
      rewriteLegacySupabaseStorageUrl(
        "http://staticmap.kakao.com/staticmap/og?type=place"
      )
    ).toBe("https://staticmap.kakao.com/staticmap/og?type=place");
  });
});
