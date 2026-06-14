import { describe, expect, it } from "vitest";
import {
  computeCuratorSpotlightScore,
  getPlaceSearchEngagement,
  isCuratorSpotlightCandidate,
  rankCuratorSpotlightPlaces,
} from "./curatorSpotlightRank.js";

describe("curatorSpotlightRank", () => {
  it("prefers higher click/impression engagement", () => {
    const map = { "kakao-1": { impressions: 40, clicks: 8 } };
    const hot = { id: "kakao-1", name: "Hot", curatorCount: 1 };
    const cold = { id: "uuid-2", name: "Cold", curatorCount: 3 };
    expect(computeCuratorSpotlightScore(hot, map)).toBeGreaterThan(
      computeCuratorSpotlightScore(cold, map)
    );
  });

  it("includes search-popular places without curator count", () => {
    const map = { p1: { impressions: 10, clicks: 2 } };
    const place = { id: "p1", name: "검색만", curatorCount: 0 };
    expect(isCuratorSpotlightCandidate(place, map)).toBe(true);
    expect(getPlaceSearchEngagement(place, map).clicks).toBe(2);
  });

  it("returns up to 12 ranked places", () => {
    const places = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      name: `Place ${i}`,
      curatorCount: 1,
    }));
    const ranked = rankCuratorSpotlightPlaces(places, {}, 0);
    expect(ranked.length).toBe(12);
  });
});
