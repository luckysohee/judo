import { describe, expect, it } from "vitest";
import {
  pickPersonalTastePlaces,
  scorePlaceWithSearchSignals,
} from "./personalPlaceRecommend.js";

const places = [
  { id: "p1", name: "성수 내추럴 와인바", tags: ["조용한", "데이트"], category: "와인바" },
  { id: "p2", name: "강남 포차", tags: ["시끌"], category: "포차" },
  { id: "p3", name: "연남 칵테일", tags: ["분위기"], category: "바" },
];

const searchSignals = {
  regions: [{ value: "성수", count: 3 }],
  liquor: [{ value: "와인", count: 2 }],
  vibes: [{ value: "조용한", count: 1 }],
  topQueries: [],
  totalSearches: 6,
};

describe("scorePlaceWithSearchSignals", () => {
  it("scores higher when place matches search signals", () => {
    const hit = scorePlaceWithSearchSignals(places[0], searchSignals);
    const miss = scorePlaceWithSearchSignals(places[1], searchSignals);
    expect(hit.score).toBeGreaterThan(miss.score);
    expect(hit.matched.region).toBe("성수");
  });
});

describe("pickPersonalTastePlaces", () => {
  it("returns [] when no signals at all", () => {
    expect(pickPersonalTastePlaces(places, {})).toEqual([]);
  });

  it("ranks by search signals and attaches reason", () => {
    const out = pickPersonalTastePlaces(places, { searchSignals }, { limit: 2 });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].id).toBe("p1");
    expect(out[0]._recommendReason).toContain("자주 찾으심");
  });

  it("gives picked-curator bonus and reason", () => {
    const pickedPlaceIds = new Set(["p2"]);
    const pickedPlaceInfo = new Map([["p2", { handle: "humblefetish", name: "허름페티쉬" }]]);
    const out = pickPersonalTastePlaces(
      places,
      { pickedPlaceIds, pickedPlaceInfo },
      { limit: 3 }
    );
    const p2 = out.find((p) => p.id === "p2");
    expect(p2).toBeTruthy();
    expect(p2._recommendReason).toContain("@humblefetish 픽");
  });

  it("combines onboarding + search + picked", () => {
    const profile = {
      liquor_types: ["와인"],
      vibes: ["조용한"],
      regions: ["성수"],
      situations: ["date"],
      onboarding_status: "completed",
    };
    const out = pickPersonalTastePlaces(
      places,
      {
        profile,
        searchSignals,
        pickedPlaceIds: new Set(["p1"]),
        pickedPlaceInfo: new Map([["p1", { handle: "x", name: "" }]]),
      },
      { limit: 1 }
    );
    expect(out[0].id).toBe("p1");
  });
});
