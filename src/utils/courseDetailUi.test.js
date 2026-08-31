import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isValidUuidCourseId,
  getCourseVisibilityBadge,
  canDuplicatePublishedPublicCourse,
  shareOrCopyCourseLink,
} from "./courseDetailUi.js";

const GOOD =
  "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("isValidUuidCourseId", () => {
  it("accepts lowercase uuid v4 shape", () => {
    expect(isValidUuidCourseId(GOOD)).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidUuidCourseId("")).toBe(false);
    expect(isValidUuidCourseId("not-a-uuid")).toBe(false);
  });
});

describe("getCourseVisibilityBadge", () => {
  it("draft", () => {
    expect(getCourseVisibilityBadge({ status: "draft" })).toEqual({
      kind: "draft",
      label: "임시저장",
    });
  });
  it("private status", () => {
    expect(getCourseVisibilityBadge({ status: "private" })).toEqual({
      kind: "private",
      label: "비공개 코스",
    });
  });
  it("published but not public", () => {
    expect(
      getCourseVisibilityBadge({ status: "published", is_public: false })
    ).toEqual({
      kind: "private",
      label: "비공개 코스",
    });
  });
  it("published public → no badge", () => {
    expect(
      getCourseVisibilityBadge({ status: "published", is_public: true })
    ).toBeNull();
  });
});

describe("canDuplicatePublishedPublicCourse", () => {
  it("true only for published+public", () => {
    expect(
      canDuplicatePublishedPublicCourse({
        status: "published",
        is_public: true,
      })
    ).toBe(true);
    expect(
      canDuplicatePublishedPublicCourse({
        status: "published",
        is_public: false,
      })
    ).toBe(false);
    expect(canDuplicatePublishedPublicCourse({ status: "draft" })).toBe(false);
  });
});

describe("shareOrCopyCourseLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses clipboard when share missing", async () => {
    const wt = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: wt } });
    const r = await shareOrCopyCourseLink({
      url: "https://example.com/c",
      title: "T",
    });
    expect(r).toBe("clipboard");
    expect(wt).toHaveBeenCalledWith("T\nhttps://example.com/c");
  });

  it("uses share when available", async () => {
    const sh = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      share: sh,
      clipboard: { writeText: vi.fn() },
    });
    const r = await shareOrCopyCourseLink({
      url: "https://example.com/x",
      title: "코스",
    });
    expect(r).toBe("shared");
    expect(sh).toHaveBeenCalled();
  });
});
