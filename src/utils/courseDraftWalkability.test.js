import { describe, expect, it } from "vitest";
import {
  COURSE_DRAFT_WALK_MAX_M,
  filterPlacesForWalkableCourseDraft,
  maxWalkingLegMeters,
  orderDraftStepsForWalking,
  sanitizeCourseDraftForWalkability,
  walkingMetersBetweenPlaces,
} from "./courseDraftWalkability.js";

describe("courseDraftWalkability", () => {
  const nearA = {
    id: "a",
    name: "A",
    lat: 37.5178,
    lng: 126.8945,
  };
  const nearB = {
    id: "b",
    name: "B",
    lat: 37.5185,
    lng: 126.896,
  };
  const farC = {
    id: "c",
    name: "C",
    lat: 37.566,
    lng: 126.991,
  };

  it("walkingMetersBetweenPlaces computes distance", () => {
    const d = walkingMetersBetweenPlaces(nearA, nearB);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(500);
  });

  it("filterPlacesForWalkableCourseDraft drops far outliers", () => {
    const out = filterPlacesForWalkableCourseDraft([nearA, nearB, farC]);
    const names = out.map((p) => p.name);
    expect(names).toContain("A");
    expect(names).toContain("B");
    expect(names).not.toContain("C");
  });

  it("sanitizeCourseDraftForWalkability reorders and trims long legs", () => {
    const placeByKey = new Map([
      ["a", nearA],
      ["b", nearB],
      ["c", farC],
    ]);
    const draft = sanitizeCourseDraftForWalkability(
      {
        steps: [
          { placeKey: "c", memo: "", visit_tip: "", stay_minutes: 0 },
          { placeKey: "a", memo: "", visit_tip: "", stay_minutes: 0 },
          { placeKey: "b", memo: "", visit_tip: "", stay_minutes: 0 },
        ],
      },
      placeByKey
    );
    expect(draft.steps.map((s) => s.placeKey).sort()).toEqual(["a", "b"]);
    expect(
      maxWalkingLegMeters(draft.steps, placeByKey)
    ).toBeLessThanOrEqual(COURSE_DRAFT_WALK_MAX_M);
  });

  it("orderDraftStepsForWalking chains nearby stops", () => {
    const placeByKey = new Map([
      ["a", nearA],
      ["b", nearB],
    ]);
    const ordered = orderDraftStepsForWalking(
      [
        { placeKey: "b", memo: "", visit_tip: "", stay_minutes: 0 },
        { placeKey: "a", memo: "", visit_tip: "", stay_minutes: 0 },
      ],
      placeByKey
    );
    expect(ordered).toHaveLength(2);
    expect(
      maxWalkingLegMeters(ordered, placeByKey)
    ).toBeLessThanOrEqual(COURSE_DRAFT_WALK_MAX_M);
  });
});
