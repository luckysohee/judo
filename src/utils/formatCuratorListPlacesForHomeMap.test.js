import { describe, expect, it } from "vitest";
import { formatCuratorListPlacesForHomeMap } from "./formatCuratorListPlacesForHomeMap";

describe("formatCuratorListPlacesForHomeMap", () => {
  it("keeps list pins with lat/lng and sets x/y from WGS84", () => {
    const out = formatCuratorListPlacesForHomeMap(
      [
        {
          place_id: "fc74f961-8988-47d9-82a5-b1315fcb5921",
          order_index: 0,
          memo: "만두",
          place_name: "은마왕만두",
          place_address: "서울 강남구 삼성로 212",
          lat: 37.4953251721527,
          lng: 127.063959499196,
          kakao_place_id: "16500024",
        },
      ],
      "curator-user"
    );
    expect(out).toHaveLength(1);
    expect(out[0].isListSpreadPin).toBe(true);
    expect(out[0].lat).toBeCloseTo(37.4953251721527);
    expect(out[0].lng).toBeCloseTo(127.063959499196);
    expect(out[0].y).toBe(String(out[0].lat));
    expect(out[0].x).toBe(String(out[0].lng));
    expect(out[0].curatorPlaces[0].curator_id).toBe("curator-user");
  });

  it("drops rows without coordinates", () => {
    expect(
      formatCuratorListPlacesForHomeMap(
        [{ place_id: "a", place_name: "x" }],
        "c"
      )
    ).toEqual([]);
  });
});
