import { describe, expect, it } from "vitest";
import { pickMainClusterPlacesForMapFit } from "./listSpreadMapFit";

describe("pickMainClusterPlacesForMapFit", () => {
  it("keeps a local cluster and drops a far outlier", () => {
    const places = [
      { id: "1", lat: 37.504, lng: 127.049 },
      { id: "2", lat: 37.505, lng: 127.05 },
      { id: "3", lat: 37.503, lng: 127.048 },
      { id: "4", lat: 37.576, lng: 126.973 }, // Jongno outlier
    ];
    const kept = pickMainClusterPlacesForMapFit(places, { maxRadiusM: 3500 });
    const ids = kept.map((p) => p.id);
    expect(ids).toContain("1");
    expect(ids).toContain("2");
    expect(ids).toContain("3");
    expect(ids).not.toContain("4");
  });

  it("keeps all when they are nearby", () => {
    const places = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      lat: 37.504 + i * 0.001,
      lng: 127.049 + i * 0.001,
    }));
    expect(pickMainClusterPlacesForMapFit(places)).toHaveLength(6);
  });
});
