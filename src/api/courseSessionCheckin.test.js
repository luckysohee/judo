import { describe, expect, it } from "vitest";
import { checkinIdMatchesStepPlace } from "../utils/checkinIdMatchesStepPlace.js";
import { handleCourseProgressAfterCheckIn } from "./courseSessionCheckin.js";

describe("checkinIdMatchesStepPlace", () => {
  const uuid = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

  it("matches UUID string to step place_id", () => {
    expect(checkinIdMatchesStepPlace(uuid, uuid, null)).toBe(true);
  });

  it("matches kakao id stored in check_ins to places row", () => {
    const pl = {
      id: uuid,
      place_id: "123456789",
      kakao_place_id: "123456789",
    };
    expect(checkinIdMatchesStepPlace("123456789", uuid, pl)).toBe(true);
  });

  it("uses checkinPlaceKeyFromPlace when kakao on place_id only", () => {
    const pl = { id: uuid, place_id: "987654321" };
    expect(checkinIdMatchesStepPlace("987654321", uuid, pl)).toBe(true);
  });

  it("rejects wrong place", () => {
    expect(checkinIdMatchesStepPlace("111", uuid, { id: uuid, place_id: "222" })).toBe(
      false
    );
  });
});

describe("handleCourseProgressAfterCheckIn", () => {
  it("returns no_course_context without auth context", async () => {
    const r = await handleCourseProgressAfterCheckIn("123");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_course_context");
  });
});
