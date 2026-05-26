import { describe, expect, it } from "vitest";
import {
  nearestVerticalSnapSheetSnap,
  verticalSnapSheetHeightFor,
} from "./useVerticalSnapSheet";

const heights = { expandedPx: 400, collapsedPx: 136, minimizedPx: 52 };

describe("nearestVerticalSnapSheetSnap", () => {
  it("snaps to nearest of three tiers", () => {
    expect(nearestVerticalSnapSheetSnap(380, heights)).toBe("expanded");
    expect(nearestVerticalSnapSheetSnap(200, heights)).toBe("collapsed");
    expect(nearestVerticalSnapSheetSnap(60, heights)).toBe("minimized");
  });
});

describe("verticalSnapSheetHeightFor", () => {
  it("returns px per snap id", () => {
    expect(verticalSnapSheetHeightFor("minimized", heights)).toBe(52);
    expect(verticalSnapSheetHeightFor("collapsed", heights)).toBe(136);
    expect(verticalSnapSheetHeightFor("expanded", heights)).toBe(400);
  });
});
