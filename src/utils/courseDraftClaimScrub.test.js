import { describe, expect, it } from "vitest";
import {
  scrubDraftStepClaims,
  scrubUnsupportedClaims,
} from "./courseDraftClaimScrub.js";
import { sanitizeCourseDraftAssistOutput } from "./courseDraftAssistSanitize.js";

describe("courseDraftClaimScrub", () => {
  it("근거 없으면 노포·해물 주장을 제거한다", () => {
    const ev = "백수씨심야식당 술집 호프 서울 중구";
    expect(
      scrubUnsupportedClaims("백수씨심야식당은 충무로 노포 맛집", ev)
    ).not.toMatch(/노포/);
    expect(
      scrubUnsupportedClaims("다시열린하얀집 해물파전·모둠회 추천", ev)
    ).not.toMatch(/해물|모둠회/);
  });

  it("comment에 근거 있으면 유지한다", () => {
    const ev = "하얀집 한식 해물파전 별미";
    expect(scrubUnsupportedClaims("하얀집 해물파전 추천", ev)).toMatch(/해물/);
  });

  it("step memo 환각을 안전 문구로 바꾼다", () => {
    const step = scrubDraftStepClaims(
      {
        placeKey: "x",
        memo: "백수씨심야식당은 오래된 노포로 유명",
        visit_tip: "모둠회 필수",
        stay_minutes: 40,
      },
      {
        placeKey: "x",
        name: "백수씨심야식당",
        category: "술집 > 호프",
        address: "서울 중구 충무로",
        comment: "",
        tags: [],
      }
    );
    expect(step.memo).not.toMatch(/노포/);
    expect(step.visit_tip).toBe("");
  });
});

describe("sanitizeCourseDraftAssistOutput claim scrub", () => {
  it("description의 근거 없는 노포·해물을 제거한다", () => {
    const places = [
      {
        placeKey: "a",
        name: "백수씨심야식당",
        category: "술집 > 호프",
        address: "서울 중구",
        comment: "",
      },
      {
        placeKey: "b",
        name: "다시열린하얀집",
        category: "한식",
        address: "서울 중구",
        comment: "",
      },
    ];
    const draft = sanitizeCourseDraftAssistOutput(
      {
        title: "충무로",
        description:
          "백수씨심야식당 노포에서 시작해 다시열린하얀집 해물파전으로 마무리",
        area: "충무로",
        theme_tags: ["노포", "해물"],
        route_tips: ["백수씨심야식당→다시열린하얀집 노포 동선"],
        visit_checklist: ["다시열린하얀집 — 모둠회 주문"],
        steps: [
          {
            placeKey: "a",
            memo: "백수씨심야식당 노포",
            visit_tip: "맥주",
            stay_minutes: 40,
          },
          {
            placeKey: "b",
            memo: "다시열린하얀집 해물안주",
            visit_tip: "파전",
            stay_minutes: 40,
          },
        ],
      },
      ["a", "b"],
      places
    );
    expect(draft.description).not.toMatch(/노포|해물/);
    expect(draft.steps[0].memo).not.toMatch(/노포/);
    expect(draft.steps[1].memo).not.toMatch(/해물/);
    expect(draft.theme_tags.join(" ")).not.toMatch(/노포|해물/);
  });
});
