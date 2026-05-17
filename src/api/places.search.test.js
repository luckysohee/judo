import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("./client.js", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

import {
  mapPlaceRowForCourse,
  searchPlacesForCourse,
  SEARCH_PLACES_FOR_COURSE_MIN_LEN,
} from "./places.js";

function mockSelectChain(rows, error = null) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error });
  const or = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ or });
  mockFrom.mockReturnValue({ select });
}

describe("searchPlacesForCourse", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns [] for query shorter than 2 chars without calling supabase", async () => {
    expect(await searchPlacesForCourse("")).toEqual([]);
    expect(await searchPlacesForCourse("x")).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("exports min length 2", () => {
    expect(SEARCH_PLACES_FOR_COURSE_MIN_LEN).toBe(2);
  });

  it("queries places and sorts coords-first", async () => {
    mockSelectChain([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "A",
        address: "",
        category: "술집",
        lat: null,
        lng: null,
        is_archived: false,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "B",
        address: "강남",
        category: "바",
        lat: 37.5,
        lng: 127.0,
        is_archived: false,
      },
    ]);
    const out = await searchPlacesForCourse("강남");
    expect(mockFrom).toHaveBeenCalledWith("places");
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(out[1].id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("drops is_archived true rows", async () => {
    mockSelectChain([
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "X",
        address: "",
        category: "",
        lat: 1,
        lng: 2,
        is_archived: true,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        name: "Y",
        address: "Seoul",
        category: "pub",
        lat: 1,
        lng: 2,
        is_archived: false,
      },
    ]);
    const out = await searchPlacesForCourse("서울");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  });
});

describe("mapPlaceRowForCourse", () => {
  it("prefers place_name when name empty", () => {
    const m = mapPlaceRowForCourse({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      name: "",
      place_name: "PN",
      road_address_name: "R",
      category: "C",
    });
    expect(m.name).toBe("PN");
    expect(m.address).toContain("R");
  });
});
