import { describe, expect, it } from "vitest";
import {
  getHomeMapViewportPlaceLimit,
  HOME_MAP_VIEWPORT_LIMIT_DEFAULT,
  HOME_MAP_VIEWPORT_LIMIT_ZOOMED_IN,
  shouldSkipMapViewportRefetch,
} from "./homeMapViewportLimit";

describe("getHomeMapViewportPlaceLimit", () => {
  it("keeps 120 on default Seongsu first screen (level 5)", () => {
    expect(getHomeMapViewportPlaceLimit(5)).toBe(HOME_MAP_VIEWPORT_LIMIT_DEFAULT);
    expect(getHomeMapViewportPlaceLimit(6)).toBe(120);
    expect(getHomeMapViewportPlaceLimit(8)).toBe(120);
  });

  it("raises to 200 when zoomed in (level ≤ 4)", () => {
    expect(getHomeMapViewportPlaceLimit(4)).toBe(HOME_MAP_VIEWPORT_LIMIT_ZOOMED_IN);
    expect(getHomeMapViewportPlaceLimit(2)).toBe(200);
  });

  it("caps curator chip filter at 200", () => {
    expect(getHomeMapViewportPlaceLimit(3, { hasCuratorChipFilter: true })).toBe(200);
    expect(getHomeMapViewportPlaceLimit(8, { hasCuratorChipFilter: true })).toBe(150);
  });

  it("skips refetch when viewport still inside last padded bbox", () => {
    const last = {
      padded: { sw: { lat: 37.5, lng: 127.0 }, ne: { lat: 37.6, lng: 127.1 } },
      limit: 120,
      hasCuratorChipFilter: false,
      widenForSituation: false,
    };
    expect(
      shouldSkipMapViewportRefetch(
        {
          boundsRaw: { sw: { lat: 37.52, lng: 127.02 }, ne: { lat: 37.58, lng: 127.08 } },
          limit: 120,
          mapLevel: 5,
          hasCuratorChipFilter: false,
          widenForSituation: false,
        },
        last,
      ),
    ).toBe(true);
    expect(
      shouldSkipMapViewportRefetch(
        {
          boundsRaw: { sw: { lat: 37.4, lng: 126.9 }, ne: { lat: 37.45, lng: 126.95 } },
          limit: 120,
          mapLevel: 5,
          hasCuratorChipFilter: false,
          widenForSituation: false,
        },
        last,
      ),
    ).toBe(false);
  });

  it("skips boot→idle refetch when bbox inside but idle asks higher limit at level 5", () => {
    const last = {
      padded: { sw: { lat: 37.5, lng: 127.0 }, ne: { lat: 37.6, lng: 127.1 } },
      limit: 40,
      hasCuratorChipFilter: false,
      widenForSituation: false,
    };
    expect(
      shouldSkipMapViewportRefetch(
        {
          boundsRaw: { sw: { lat: 37.52, lng: 127.02 }, ne: { lat: 37.58, lng: 127.08 } },
          limit: 120,
          mapLevel: 5,
          hasCuratorChipFilter: false,
          widenForSituation: false,
        },
        last,
      ),
    ).toBe(true);
  });
});
