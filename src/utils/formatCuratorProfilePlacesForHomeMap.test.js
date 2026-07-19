import { describe, expect, it } from "vitest";
import {
  formatCuratorProfilePlaceForHomeMap,
  mergeCuratorProfilePlacesIntoDbPlaces,
  removeListSpreadPinsFromDbPlaces,
} from "./formatCuratorProfilePlacesForHomeMap";

describe("mergeCuratorProfilePlacesIntoDbPlaces", () => {
  it("adds new curator places and merges curatorPlaces onto existing rows", () => {
    const existing = {
      id: "p1",
      name: "Existing",
      lat: 37.54,
      lng: 127.05,
      curatorPlaces: [{ curator_id: "uid-a" }],
      curatorCount: 1,
    };
    const incomingA = formatCuratorProfilePlaceForHomeMap(
      {
        id: "p1",
        name: "Existing",
        lat: 37.54,
        lng: 127.05,
        comment: "한줄",
      },
      "uid-b"
    );
    const incomingB = formatCuratorProfilePlaceForHomeMap(
      {
        id: "p2",
        name: "New",
        lat: 37.55,
        lng: 127.06,
      },
      "uid-b"
    );

    const merged = mergeCuratorProfilePlacesIntoDbPlaces(existing ? [existing] : [], [
      incomingA,
      incomingB,
    ]);

    expect(merged).toHaveLength(2);
    const p1 = merged.find((p) => p.id === "p1");
    expect(p1.curatorPlaces.map((c) => c.curator_id).sort()).toEqual([
      "uid-a",
      "uid-b",
    ]);
    expect(merged.some((p) => p.id === "p2")).toBe(true);
  });
});

describe("removeListSpreadPinsFromDbPlaces", () => {
  it("drops only list-spread pins", () => {
    const next = removeListSpreadPinsFromDbPlaces([
      { id: "a", name: "Keep" },
      { id: "b", name: "Spread", isListSpreadPin: true },
      { id: "c", name: "Also", isListSpreadPin: true },
    ]);
    expect(next.map((p) => p.id)).toEqual(["a"]);
  });
});
