import { describe, expect, it } from "vitest";
import {
  CHECKIN_ALLOW_RADIUS_M,
  shouldRefetchKakaoCoordsForCheckin,
} from "./placeCoords";

describe("shouldRefetchKakaoCoordsForCheckin", () => {
  const place = { lat: 37.54465, lng: 127.05595 };

  it("skips kakao when user is near stored coords", () => {
    expect(
      shouldRefetchKakaoCoordsForCheckin(
        place.lat,
        place.lng,
        place.lat + 0.0008,
        place.lng + 0.0008,
      ),
    ).toBe(false);
  });

  it("requests kakao when coords missing", () => {
    expect(shouldRefetchKakaoCoordsForCheckin(null, null, 37.5, 127.0)).toBe(
      true,
    );
  });

  it("skips kakao when user is very far (pin fix unlikely)", () => {
    expect(
      shouldRefetchKakaoCoordsForCheckin(
        place.lat,
        place.lng,
        37.57,
        127.03,
      ),
    ).toBe(false);
  });

  it("allow radius matches server band", () => {
    expect(CHECKIN_ALLOW_RADIUS_M).toBeGreaterThanOrEqual(400);
  });
});
