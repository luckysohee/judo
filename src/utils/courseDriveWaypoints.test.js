import { describe, expect, it } from "vitest";
import {
  courseDriveWaypoints,
  courseRouteLabelPosition,
} from "./courseDriveWaypoints";

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

  it("offsets label from path midpoint so box does not sit on polyline", () => {
    const path = [
      { lat: 37.5, lng: 127.0 },
      { lat: 37.51, lng: 127.02 },
    ];
    const onPath = {
      lat: (path[0].lat + path[1].lat) / 2,
      lng: (path[0].lng + path[1].lng) / 2,
    };
    const pos = courseRouteLabelPosition(null, path);
    expect(pos).not.toBeNull();
    const dLat = Math.abs(pos.lat - onPath.lat);
    const dLng = Math.abs(pos.lng - onPath.lng);
    expect(dLat + dLng).toBeGreaterThan(0.0002);
  });
});
