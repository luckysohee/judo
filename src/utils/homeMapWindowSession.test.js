import { beforeEach, describe, expect, it } from "vitest";
import { HOME_CURATOR_PLACE_FOCUS_STATE } from "./homeCuratorPlaceNavigation";
import { HOME_START_COURSE_FOLLOW_STATE } from "./homeCourseFollowNavigation";
import {
  computeHomeViewportCacheKey,
  defaultHomeMapViewportBounds,
} from "./homeMapViewportBounds";
import { HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT } from "./homeMapViewportLimit";
import {
  MAP_VIEWPORT_SESSION_CACHE_KEY,
  writeHomeMapViewportSessionCache,
} from "./homeMapViewportSessionCache";
import {
  HOME_MAP_WINDOW_SESSION_KEY,
  HOME_MAP_WINDOW_SESSION_TTL_MS,
  clearHomeMapWindowSession,
  homeMapWindowPlaceCacheKeys,
  normalizeHomeMapWindow,
  readHomeMapBootPlaceCache,
  readHomeMapWindowSession,
  resolveHomeMapBootWindow,
  writeHomeMapWindowSession,
} from "./homeMapWindowSession";

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

const HONGDAE_WINDOW = {
  lat: 37.557,
  lng: 126.924,
  level: 4,
  bounds: {
    sw: { lat: 37.548, lng: 126.91 },
    ne: { lat: 37.566, lng: 126.938 },
  },
};

describe("homeMapWindowSession", () => {
  beforeEach(() => {
    globalThis.sessionStorage = memoryStorage();
    globalThis.localStorage = memoryStorage();
  });

  it("round-trips a valid Korea map window", () => {
    expect(writeHomeMapWindowSession(HONGDAE_WINDOW)).toBe(true);
    expect(readHomeMapWindowSession()).toEqual(HONGDAE_WINDOW);
    expect(localStorage.getItem(HOME_MAP_WINDOW_SESSION_KEY)).toBeTruthy();
  });

  it("rejects coordinates outside Korea and incomplete bounds", () => {
    expect(
      writeHomeMapWindowSession({
        ...HONGDAE_WINDOW,
        lat: 35.68,
        lng: 139.76,
      }),
    ).toBe(false);
    expect(
      normalizeHomeMapWindow({
        lat: 37.55,
        lng: 127.05,
        level: 5,
      }),
    ).toBeNull();
    expect(readHomeMapWindowSession()).toBeNull();
  });

  it("expires after TTL", () => {
    writeHomeMapWindowSession(HONGDAE_WINDOW);
    const raw = JSON.parse(sessionStorage.getItem(HOME_MAP_WINDOW_SESSION_KEY));
    raw.ts = Date.now() - HOME_MAP_WINDOW_SESSION_TTL_MS - 1;
    sessionStorage.setItem(HOME_MAP_WINDOW_SESSION_KEY, JSON.stringify(raw));
    localStorage.removeItem(HOME_MAP_WINDOW_SESSION_KEY);
    expect(readHomeMapWindowSession()).toBeNull();
  });

  it("falls back to localStorage when session is empty", () => {
    writeHomeMapWindowSession(HONGDAE_WINDOW);
    sessionStorage.removeItem(HOME_MAP_WINDOW_SESSION_KEY);
    expect(readHomeMapWindowSession()).toEqual(HONGDAE_WINDOW);
  });

  it("skips restore for course-follow and curator-place focus navigations", () => {
    writeHomeMapWindowSession(HONGDAE_WINDOW);
    expect(
      resolveHomeMapBootWindow({
        [HOME_START_COURSE_FOLLOW_STATE]: "course-1",
      }),
    ).toBeNull();
    expect(
      resolveHomeMapBootWindow({
        [HOME_CURATOR_PLACE_FOCUS_STATE]: {
          curatorUserId: "user-1",
          placeId: "place-1",
        },
      }),
    ).toBeNull();
    expect(resolveHomeMapBootWindow({})).toEqual(HONGDAE_WINDOW);
  });

  it("restores matching viewport places for the saved window, not Seongsu", () => {
    const seongsuBounds = defaultHomeMapViewportBounds(5);
    const seongsuKey = computeHomeViewportCacheKey(seongsuBounds, 5, {
      limit: HOME_MAP_VIEWPORT_LIMIT_BOOT_DEFAULT,
    })?.cacheKey;
    writeHomeMapViewportSessionCache({
      cacheKey: seongsuKey,
      merged: [{ id: "seongsu-place" }],
    });
    expect(readHomeMapBootPlaceCache(null)?.merged).toEqual([
      { id: "seongsu-place" },
    ]);
    expect(readHomeMapBootPlaceCache(HONGDAE_WINDOW)).toBeNull();

    const hongdaeKeys = homeMapWindowPlaceCacheKeys(HONGDAE_WINDOW);
    expect(hongdaeKeys.length).toBeGreaterThan(0);
    writeHomeMapViewportSessionCache({
      cacheKey: hongdaeKeys[0],
      merged: [{ id: "hongdae-place" }],
    });
    expect(readHomeMapBootPlaceCache(HONGDAE_WINDOW)?.merged).toEqual([
      { id: "hongdae-place" },
    ]);
    expect(sessionStorage.getItem(MAP_VIEWPORT_SESSION_CACHE_KEY)).toBeTruthy();
  });

  it("clears both storages", () => {
    writeHomeMapWindowSession(HONGDAE_WINDOW);
    clearHomeMapWindowSession();
    expect(readHomeMapWindowSession()).toBeNull();
    expect(sessionStorage.getItem(HOME_MAP_WINDOW_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(HOME_MAP_WINDOW_SESSION_KEY)).toBeNull();
  });
});
