import { describe, expect, it } from "vitest";
import { computeDensityGridCellSize } from "./densityGridCellSize";

describe("computeDensityGridCellSize", () => {
  it("uses coarser cells when zoomed out", () => {
    const lat = 37.54465;
    const lng = 127.05595;
    const scale = Math.pow(2, 3);
    const south = lat - 0.009 * scale * 1.24;
    const north = lat + 0.009 * scale * 1.24;
    const west = lng - 0.011 * scale * 1.24;
    const east = lng + 0.011 * scale * 1.24;

    const cell7 = computeDensityGridCellSize(7, south, west, north, east);
    expect(cell7).toBeGreaterThanOrEqual(0.007);

    const cell9 = computeDensityGridCellSize(
      9,
      south - 0.05,
      west - 0.06,
      north + 0.05,
      east + 0.06,
    );
    expect(cell9).toBeGreaterThan(cell7);
  });
});
