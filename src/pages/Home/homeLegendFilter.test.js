import { describe, expect, it } from "vitest";
import { applyLegendCategoryFilter } from "./homeModule";

const me = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
const third = "33333333-3333-3333-3333-333333333333";

describe("applyLegendCategoryFilter", () => {
  it("별(본인 단독) 장소는 마커 안내 basic 에서 제외", () => {
    const mineOnly = {
      id: "a",
      curatorCount: 1,
      curatorPlaces: [{ curator_id: me }],
    };
    const otherSolo = {
      id: "b",
      curatorCount: 1,
      curatorPlaces: [{ curator_id: other }],
    };
    const out = applyLegendCategoryFilter([mineOnly, otherSolo], "basic", {
      userId: me,
      curatorProfile: { user_id: me },
    });
    expect(out.map((p) => p.id)).toEqual(["b"]);
  });

  it("공동 추천은 큐레이터 2명 장소만", () => {
    const hot = {
      id: "hot",
      curatorCount: 2,
      curatorPlaces: [{ curator_id: me }, { curator_id: other }],
    };
    const basic = {
      id: "basic",
      curatorCount: 1,
      curatorPlaces: [{ curator_id: other }],
    };
    const out = applyLegendCategoryFilter([hot, basic], "hot", {
      userId: me,
      curatorProfile: { user_id: me },
    });
    expect(out.map((p) => p.id)).toEqual(["hot"]);
  });

  it("프리미엄은 큐레이터 3명 이상", () => {
    const premium = {
      id: "prem",
      curatorCount: 3,
      curatorPlaces: [
        { curator_id: me },
        { curator_id: other },
        { curator_id: third },
      ],
    };
    const out = applyLegendCategoryFilter([premium], "premium", {
      userId: me,
      curatorProfile: { user_id: me },
    });
    expect(out.map((p) => p.id)).toEqual(["prem"]);
  });
});
