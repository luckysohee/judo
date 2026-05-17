import { describe, it, expect } from "vitest";
import {
  buildCourseMapPreviewModel,
  parseCoursePreviewCoord,
} from "./courseMapPreviewModel.js";

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("parseCoursePreviewCoord", () => {
  it("parses numeric strings", () => {
    expect(parseCoursePreviewCoord("37.5")).toBe(37.5);
    expect(parseCoursePreviewCoord("127")).toBe(127);
  });
  it("returns null for empty or invalid", () => {
    expect(parseCoursePreviewCoord(null)).toBe(null);
    expect(parseCoursePreviewCoord("")).toBe(null);
    expect(parseCoursePreviewCoord("x")).toBe(null);
  });
});

describe("buildCourseMapPreviewModel", () => {
  it("empty course → hint", () => {
    const m = buildCourseMapPreviewModel([]);
    expect(m.showEmptyCourseHint).toBe(true);
    expect(m.points).toEqual([]);
  });

  it("two coord stops → two points and order", () => {
    const m = buildCourseMapPreviewModel([
      {
        key: "a",
        place_id: UUID,
        place_lat: 37.5,
        place_lng: 127.1,
      },
      {
        key: "b",
        place_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        place_lat: 37.51,
        place_lng: 127.11,
      },
    ]);
    expect(m.points).toHaveLength(2);
    expect(m.points[0].order).toBe(1);
    expect(m.points[1].order).toBe(2);
    expect(m.missingCoordCount).toBe(0);
    expect(m.showMissingCoordHint).toBe(false);
  });

  it("reorder rows changes point order values", () => {
    const rowsBFirst = [
      {
        key: "b",
        place_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        place_lat: 37.51,
        place_lng: 127.11,
      },
      {
        key: "a",
        place_id: UUID,
        place_lat: 37.5,
        place_lng: 127.1,
      },
    ];
    const m = buildCourseMapPreviewModel(rowsBFirst);
    expect(m.points[0].order).toBe(1);
    expect(m.points[0].lat).toBe(37.51);
    expect(m.points[1].order).toBe(2);
  });

  it("skips invalid uuid rows", () => {
    const m = buildCourseMapPreviewModel([
      { key: "x", place_id: "not-uuid", place_lat: 1, place_lng: 2 },
    ]);
    expect(m.uuidRowCount).toBe(0);
    expect(m.showEmptyCourseHint).toBe(true);
  });

  it("counts missing coords for hint", () => {
    const m = buildCourseMapPreviewModel([
      { key: "a", place_id: UUID, place_lat: null, place_lng: null },
    ]);
    expect(m.uuidRowCount).toBe(1);
    expect(m.points).toHaveLength(0);
    expect(m.missingCoordCount).toBe(1);
    expect(m.showMissingCoordHint).toBe(true);
  });

  it("single drawable point", () => {
    const m = buildCourseMapPreviewModel([
      { key: "a", place_id: UUID, place_lat: 37.5, place_lng: 127 },
    ]);
    expect(m.points).toHaveLength(1);
    expect(m.points[0].order).toBe(1);
  });
});
