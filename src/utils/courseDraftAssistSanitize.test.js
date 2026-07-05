import { describe, expect, it } from "vitest";
import { sanitizeCourseDraftAssistOutput } from "./courseDraftAssistSanitize.js";

describe("sanitizeCourseDraftAssistOutput", () => {
  const places = [
    {
      placeKey: "a",
      name: "베통",
      category: "베이커리",
      address: "서울 성동구 성수동",
      comment: "소금빵 필수",
    },
    {
      placeKey: "b",
      name: "크램",
      category: "베이커리",
      address: "서울 성동구 연무장",
      comment: "크로issant·무화과 토스트",
    },
    {
      placeKey: "c",
      name: "성수베이킹",
      category: "베이커리",
      address: "서울 성동구",
      comment: "크루아상",
    },
  ];

  it("prefers place-specific route tips over generic ones", () => {
    const draft = sanitizeCourseDraftAssistOutput(
      {
        title: "성수 빵",
        description: "베통·크램 중심",
        area: "성수",
        theme_tags: ["빵"],
        route_tips: [
          "주차가 어려우니 대중교통을 이용하세요.",
          "베통→크램: 성수역 쪽 먼저 두면 소금빵 품절 전 두 곳 커버",
          "영업시간을 미리 확인하세요.",
        ],
        visit_checklist: [
          "SNS에서 품절 확인",
          "크램 — 무화과 토스트 오후 품절 잦음, 오전 방문",
        ],
        steps: [
          { placeKey: "a", memo: "소금빵", visit_tip: "오전", stay_minutes: 20 },
          { placeKey: "b", memo: "토스트", visit_tip: "테이크아웃", stay_minutes: 15 },
        ],
      },
      ["a", "b"],
      places
    );

    expect(draft.route_tips.some((t) => t.includes("베통"))).toBe(true);
    expect(draft.route_tips.some((t) => /주차/.test(t))).toBe(false);
    expect(draft.visit_checklist.some((t) => t.includes("크램"))).toBe(true);
  });

  it("rejects draft when exact 3-stop course has only 2 steps", () => {
    const draft = sanitizeCourseDraftAssistOutput(
      {
        title: "3차",
        description: "test",
        area: "문래",
        theme_tags: [],
        route_tips: ["베통→크램 동선"],
        visit_checklist: ["베통 웨이팅"],
        steps: [
          { placeKey: "a", memo: "a", visit_tip: "a", stay_minutes: 20 },
          { placeKey: "b", memo: "b", visit_tip: "b", stay_minutes: 20 },
        ],
      },
      ["a", "b", "c"],
      places,
      { minSteps: 3, maxSteps: 3, exactSteps: true, targetSteps: 3 }
    );
    expect(draft).toBeNull();
  });

  it("accepts draft with exactly 3 steps for 3차", () => {
    const draft = sanitizeCourseDraftAssistOutput(
      {
        title: "3차",
        description: "test",
        area: "문래",
        theme_tags: [],
        route_tips: ["베통→크램→성수베이킹"],
        visit_checklist: ["베통 웨이팅"],
        steps: [
          { placeKey: "a", memo: "a", visit_tip: "a", stay_minutes: 20 },
          { placeKey: "b", memo: "b", visit_tip: "b", stay_minutes: 20 },
          { placeKey: "c", memo: "c", visit_tip: "c", stay_minutes: 20 },
        ],
      },
      ["a", "b", "c"],
      places,
      { minSteps: 3, maxSteps: 3, exactSteps: true, targetSteps: 3 }
    );
    expect(draft?.steps).toHaveLength(3);
  });
});
