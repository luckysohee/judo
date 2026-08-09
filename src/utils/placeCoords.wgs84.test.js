import { describe, expect, it } from "vitest";
import { resolvePlaceWgs84 } from "./placeCoords";

describe("resolvePlaceWgs84", () => {
  it("falls back to lat/lng when x/y are empty strings", () => {
    expect(
      resolvePlaceWgs84({
        y: "",
        x: "",
        lat: 37.4953251721527,
        lng: 127.063959499196,
      })
    ).toEqual({ lat: 37.4953251721527, lng: 127.063959499196 });
  });

  it("prefers finite y/x over lat/lng", () => {
    expect(
      resolvePlaceWgs84({
        y: 37.5,
        x: 127.0,
        lat: 1,
        lng: 2,
      })
    ).toEqual({ lat: 37.5, lng: 127.0 });
  });
});
