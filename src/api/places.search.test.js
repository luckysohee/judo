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
  postgrestIlikeOrPattern,
} from "./places.js";

function mockSelectChain(rows, error = null) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error });
  const or = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ or });
  mockFrom.mockReturnValue({ select });
  return { select, or, limit };
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

  it("quotes spaced ilike patterns for PostgREST .or()", () => {
    expect(postgrestIlikeOrPattern("을지로 노포 코스")).toBe(
      '"%을지로 노포 코스%"'
    );
  });

  it("queries places without is_archived and sorts coords-first", async () => {
    const { select, or } = mockSelectChain([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "A",
        address: "",
        category: "술집",
        lat: null,
        lng: null,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "B",
        address: "강남",
        category: "바",
        lat: 37.5,
        lng: 127.0,
      },
    ]);
    const out = await searchPlacesForCourse("강남");
    expect(mockFrom).toHaveBeenCalledWith("places");
    expect(select).toHaveBeenCalledWith(
      "id, name, place_name, address, category, lat, lng"
    );
    expect(String(or.mock.calls[0][0])).toContain('name.ilike."%강남%"');
    expect(String(select.mock.calls[0][0])).not.toContain("is_archived");
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(out[1].id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("quotes multi-word course-like queries", async () => {
    const { or } = mockSelectChain([]);
    await searchPlacesForCourse("을지로 노포 코스");
    expect(String(or.mock.calls[0][0])).toContain(
      'name.ilike."%을지로 노포 코스%"'
    );
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
