import { describe, expect, it } from "vitest";
import { curatorCourseRowToDrivingMap } from "./curatorCourseHomeMap";

describe("curatorCourseRowToDrivingMap", () => {
  it("returns driving map with ordered steps", () => {
    const m = curatorCourseRowToDrivingMap({
      id: "b90b4993-b1ad-488e-a3dc-f80ea648c4e0",
      title: "cdd",
      curator_course_places: [
        {
          order_index: 1,
          place_id: "11111111-1111-4111-8111-111111111111",
          places: { name: "A", lat: 37.5, lng: 127.0 },
        },
        {
          order_index: 0,
          place_id: "22222222-2222-4222-8222-222222222222",
          places: { name: "B", lat: 37.51, lng: 127.01 },
        },
      ],
    });
    expect(m?.courseId).toBe("b90b4993-b1ad-488e-a3dc-f80ea648c4e0");
    expect(m?.steps).toHaveLength(2);
    expect(m?.steps[0]?.place?.name).toBe("B");
    expect(m?.steps[1]?.place?.name).toBe("A");
  });

  it("returns null when fewer than two coords", () => {
    expect(
      curatorCourseRowToDrivingMap({
        id: "b90b4993-b1ad-488e-a3dc-f80ea648c4e0",
        curator_course_places: [
          {
            order_index: 0,
            place_id: "11111111-1111-4111-8111-111111111111",
            places: { name: "A", lat: 37.5, lng: 127.0 },
          },
        ],
      })
    ).toBeNull();
  });
});
