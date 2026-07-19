import { describe, expect, it, vi, beforeEach } from "vitest";

const fromMock = vi.fn();

vi.mock("../api/client", () => ({
  supabase: {
    from: (...args) => fromMock(...args),
  },
}));

import {
  CURATOR_COURSE_GRADE_WEIGHT,
  countCuratorGradeContributions,
  gradeContributionTotal,
} from "./curatorGradeCount";

describe("gradeContributionTotal", () => {
  it("weights each course above a single place", () => {
    expect(gradeContributionTotal(10, 2)).toBe(10 + 2 * CURATOR_COURSE_GRADE_WEIGHT);
    expect(gradeContributionTotal(0, 1)).toBe(CURATOR_COURSE_GRADE_WEIGHT);
    expect(gradeContributionTotal(5, 0)).toBe(5);
  });
});

describe("countCuratorGradeContributions", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("applies course weight when summing", async () => {
    const placeQ = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 12, error: null }),
    };
    placeQ.select.mockReturnValue(placeQ);

    const courseQ = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ count: 3, error: null }),
    };
    courseQ.select.mockReturnValue(courseQ);
    courseQ.eq.mockReturnValue(courseQ);

    fromMock.mockImplementation((table) => {
      if (table === "curator_places") return placeQ;
      if (table === "curator_courses") return courseQ;
      throw new Error(`unexpected table ${table}`);
    });

    const res = await countCuratorGradeContributions("user-1");
    expect(res.placeCount).toBe(12);
    expect(res.courseCount).toBe(3);
    expect(res.courseWeight).toBe(CURATOR_COURSE_GRADE_WEIGHT);
    expect(res.coursePoints).toBe(9);
    expect(res.total).toBe(21);
    expect(courseQ.is).toHaveBeenCalledWith("imported_from_course_id", null);
  });

  it("returns zeros for empty user id", async () => {
    expect(await countCuratorGradeContributions("")).toEqual({
      placeCount: 0,
      courseCount: 0,
      courseWeight: CURATOR_COURSE_GRADE_WEIGHT,
      coursePoints: 0,
      total: 0,
    });
  });
});
