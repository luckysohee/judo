import { beforeEach, describe, expect, it } from "vitest";
import {
  HOME_MAP_START_MY_LOCATION,
  HOME_MAP_START_SEONGSU,
  HOME_MAP_VISIT_KEY,
  consumeHomeMapReturnVisit,
  getHomeMapReturnVisitFlag,
  readHomeMapStartMode,
  resetHomeMapReturnVisitSessionCacheForTests,
  shouldBootHomeMapAtMyLocation,
  writeHomeMapStartMode,
} from "./homeMapStartPreference";

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  resetHomeMapReturnVisitSessionCacheForTests();
});

describe("homeMapStartPreference", () => {
  it("defaults start mode to seongsu", () => {
    expect(readHomeMapStartMode()).toBe(HOME_MAP_START_SEONGSU);
  });

  it("persists my_location mode", () => {
    writeHomeMapStartMode(HOME_MAP_START_MY_LOCATION);
    expect(readHomeMapStartMode()).toBe(HOME_MAP_START_MY_LOCATION);
    writeHomeMapStartMode("invalid");
    expect(readHomeMapStartMode()).toBe(HOME_MAP_START_SEONGSU);
  });

  it("first consume is not a return visit; second is", () => {
    expect(consumeHomeMapReturnVisit()).toBe(false);
    expect(localStorage.getItem(HOME_MAP_VISIT_KEY)).toBe("true");
    expect(consumeHomeMapReturnVisit()).toBe(true);
  });

  it("session flag stays false across strict double-read on first visit", () => {
    expect(getHomeMapReturnVisitFlag()).toBe(false);
    expect(getHomeMapReturnVisitFlag()).toBe(false);
  });

  it("boots at my location only on return visit with preference", () => {
    writeHomeMapStartMode(HOME_MAP_START_MY_LOCATION);
    expect(shouldBootHomeMapAtMyLocation(false)).toBe(false);
    expect(shouldBootHomeMapAtMyLocation(true)).toBe(true);
    writeHomeMapStartMode(HOME_MAP_START_SEONGSU);
    expect(shouldBootHomeMapAtMyLocation(true)).toBe(false);
  });
});
