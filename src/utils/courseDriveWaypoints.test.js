import { describe, expect, it } from "vitest";
import { courseDriveWaypoints } from "./courseDriveWaypoints";

describe("courseDriveWaypoints", () => {
  it("extracts ordered lat/lng from steps", () => {
    const pts = courseDriveWaypoints({
      steps: [
        { place: { lat: 37.5, lng: 127.0 } },
        { place: { lat: 37.51, lng: 127.01 } },
        { place: { lat: 37.52, lng: 127.02 } },
      ],
    });
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ lat: 37.5, lng: 127 });
  });
});
