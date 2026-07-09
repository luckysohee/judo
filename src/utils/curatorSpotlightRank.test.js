import { describe, expect, it } from "vitest";
import {
  computeCuratorSpotlightScore,
  getPlaceSearchEngagement,
  isCuratorSpotlightCandidate,
  pickOffMapEngagementKeys,
  mergeSpotlightPlacePools,
  formatPlaceRowForSpotlight,
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

  it("pickOffMapEngagementKeys skips viewport places and keeps hot search keys", () => {
    const map = {
      a: { impressions: 2, clicks: 0 },
      b: { impressions: 20, clicks: 5 },
      c: { impressions: 8, clicks: 0 },
      d: { impressions: 1, clicks: 3 },
    };
    const viewport = [{ id: "b", kakao_place_id: "b" }];
    const keys = pickOffMapEngagementKeys(map, viewport, {
      limit: 10,
      minClicks: 1,
      minImpressions: 4,
    });
    expect(keys).toEqual(["d", "c"]);
    expect(keys).not.toContain("a");
    expect(keys).not.toContain("b");
  });

  it("mergeSpotlightPlacePools includes off-map places", () => {
    const merged = mergeSpotlightPlacePools(
      [{ id: "1", name: "OnMap", curatorCount: 1 }],
      [{ id: "2", name: "OffMap", curatorCount: 0 }]
    );
    expect(merged.map((p) => p.id).sort()).toEqual(["1", "2"]);
  });

  it("formatPlaceRowForSpotlight keeps kakao id for engagement match", () => {
    const row = formatPlaceRowForSpotlight({
      id: "uuid-1",
      name: "Cafe",
      kakao_place_id: "12345",
      lat: 37.5,
      lng: 127.0,
    });
    expect(row?.kakao_place_id).toBe("12345");
    expect(row?.id).toBe("uuid-1");
  });
});
