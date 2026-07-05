import { describe, expect, it } from "vitest";
import { classifyCategory } from "./intentAxisScoring.js";
import { parseCourseQuery } from "./parseCourseQuery.js";
import { placeBelongsToCourseArea } from "./generateCourseOptions.js";
import {
  buildMeetingCourseSearchPhrases,
  buildPartyCourseSearchPhrases,
  filterPlacesForCourseSuggestionIntent,
  placeIsFoodOrDrinkVenue,
  placeSignalsMeetingCasualChain,
  placeSignalsSoloDrinking,
  placeSuitableForMeetingAfter,
  placeSuitableForMeetingCourse,
  placeSuitableForMeetingPrimary,
  refineSearchPhrasesForCourseIntent,
  sanitizeCourseDraftForArea,
  sanitizeCourseDraftForIntent,
  scorePlaceForCourseSuggestionIntent,
} from "./filterPlacesForCourseSuggestionIntent.js";

describe("filterPlacesForCourseSuggestionIntent", () => {
  it("업무미팅 2차에서 혼술 장소를 걸러낸다", () => {
    const query = "을지로3가 업무미팅 2차코스";
    const places = [
      { id: "1", name: "을지로 혼술마니", category: "술집 > 호프" },
      { id: "2", name: "을지로 와인바", category: "술집 > 와인" },
      { id: "3", name: "을지로 이자카야", category: "음식점 > 일식 > 이자카야" },
    ];
    expect(placeSignalsSoloDrinking(places[0])).toBe(true);
    const out = filterPlacesForCourseSuggestionIntent(query, places);
    expect(out.some((p) => /혼술/.test(p.name))).toBe(false);
    expect(out.some((p) => /와인바/.test(p.name))).toBe(true);
    expect(out.some((p) => /이자카야/.test(p.name))).toBe(false);
  });

  it("LLM 초안에서 혼술·호프 장소 step을 제거한다", () => {
    const query = "을지로 업무미팅 2차코스";
    const placeByKey = new Map([
      ["a", { name: "혼술마니", category: "술집 > 호프" }],
      ["b", { name: "을지로 와인바", category: "술집 > 와인" }],
      ["c", { name: "을지로 이자카야", category: "음식점 > 일식 > 이자카야" }],
    ]);
    const draft = sanitizeCourseDraftForIntent(query, {
      steps: [
        { placeKey: "a", memo: "", visit_tip: "", stay_minutes: 0 },
        { placeKey: "b", memo: "", visit_tip: "", stay_minutes: 0 },
        { placeKey: "c", memo: "", visit_tip: "", stay_minutes: 0 },
      ],
    }, placeByKey);
    expect(draft.steps.map((s) => s.placeKey)).toEqual(["b"]);
  });

  it("미팅 2차에서 와인바가 혼술 주점보다 점수가 높다", () => {
    const query = "강남 업무미팅 2차";
    const wine = scorePlaceForCourseSuggestionIntent(query, {
      name: "강남 와인바",
      category: "술집 > 와인",
    });
    const solo = scorePlaceForCourseSuggestionIntent(query, {
      name: "혼술마니",
      category: "술집 > 호프",
      tags: ["혼술"],
    });
    expect(wine.score).toBeGreaterThan(solo.score);
  });

  it("미팅 검색 phrase를 와인·칵테일 위주로 보강한다", () => {
    const phrases = buildMeetingCourseSearchPhrases("을지로 업무미팅 2차", {
      area: "을지로",
    });
    expect(phrases.some((p) => /와인바|칵테일|라운지/.test(p))).toBe(true);
    expect(phrases.some((p) => /이자카야/.test(p))).toBe(false);
    expect(phrases.some((p) => /한정식/.test(p))).toBe(false);
  });

  it("업무 미팅 1차 phrase는 다이닝·일식·양식·룸 위주다", () => {
    const phrases = buildMeetingCourseSearchPhrases("강남 업무 미팅 1차", {
      area: "강남",
    });
    expect(phrases.some((p) => /한정식|다이닝|일식|양식|룸/.test(p))).toBe(true);
    expect(phrases.some((p) => /이자카야|카페/.test(p))).toBe(false);
  });

  it("미팅 질의에서 혼술·포괄 술집 phrase를 정리한다", () => {
    const refined = refineSearchPhrasesForCourseIntent(
      "을지로 업무미팅 2차코스",
      ["을지로 업무미팅 2차코스", "을지로 술집", "을지로 혼술", "을지로 맥주"],
      { area: "을지로" }
    );
    expect(refined.some((p) => /혼술/.test(p))).toBe(false);
    expect(refined.some((p) => /와인바/.test(p))).toBe(true);
    expect(refined.some((p) => /^을지로 술집$/i.test(p))).toBe(false);
  });

  it("화장품 매장은 업무 미팅 코스 후보에서 제외한다", () => {
    const cosmetics = {
      id: "cos",
      name: "올리브영 성수점",
      category: "가정,생활 > 화장품",
    };
    expect(placeIsFoodOrDrinkVenue(cosmetics)).toBe(false);
    expect(
      placeSuitableForMeetingCourse("성수 업무 미팅 2차 코스", cosmetics)
    ).toBe(false);
    expect(placeSuitableForMeetingAfter(cosmetics)).toBe(false);
  });

  it("상호에 카페인이 있어도 화장품은 카페로 보지 않는다", () => {
    const place = {
      id: "caffeine",
      name: "카페인 세럼 전문점",
      category: "가정,생활 > 화장품",
    };
    const cat = classifyCategory({
      category_name: place.category,
      place_name: place.name,
    });
    expect(cat.cafe).toBe(false);
    expect(placeIsFoodOrDrinkVenue(place)).toBe(false);
  });

  it("업무 미팅 2차 필터에서 화장품을 걸러낸다", () => {
    const query = "성수 업무 미팅 2차 코스";
    const places = [
      { id: "1", name: "올리브영", category: "가정,생활 > 화장품" },
      { id: "2", name: "성수 와인바", category: "술집 > 와인" },
      { id: "3", name: "성수 이자카야", category: "음식점 > 일식 > 이자카야" },
    ];
    const out = filterPlacesForCourseSuggestionIntent(query, places);
    expect(out.some((p) => /화장품|올리브영/.test(p.category + p.name))).toBe(
      false
    );
    expect(out.some((p) => /와인바/.test(p.name))).toBe(true);
    expect(out.some((p) => /이자카야/.test(p.name))).toBe(false);
  });

  it("LLM 초안에서 화장품 step을 제거한다", () => {
    const query = "성수 업무 미팅 2차 코스";
    const placeByKey = new Map([
      ["a", { name: "올리브영", category: "가정,생활 > 화장품" }],
      ["b", { name: "성수 와인바", category: "술집 > 와인" }],
      ["c", { name: "성수 이자카야", category: "음식점 > 일식 > 이자카야" }],
    ]);
    const draft = sanitizeCourseDraftForIntent(
      query,
      {
        steps: [
          { placeKey: "a", memo: "", visit_tip: "", stay_minutes: 0 },
          { placeKey: "b", memo: "", visit_tip: "", stay_minutes: 0 },
          { placeKey: "c", memo: "", visit_tip: "", stay_minutes: 0 },
        ],
      },
      placeByKey
    );
    expect(draft.steps.map((s) => s.placeKey)).toEqual(["b"]);
  });

  it("이자카야 체인은 업무 미팅 후보에서 제외한다", () => {
    const chain = {
      name: "을지로3가 이자카야 무한리필",
      category: "음식점 > 일식 > 이자카야",
    };
    expect(placeSignalsMeetingCasualChain(chain)).toBe(true);
    expect(placeSuitableForMeetingPrimary(chain)).toBe(false);
    expect(placeSuitableForMeetingAfter(chain)).toBe(false);
  });

  it("룸 있는 한정식은 업무 미팅 1차에 적합하다", () => {
    const dining = {
      name: "강남 ○○한정식",
      category: "음식점 > 한식 > 한정식",
      comment: "프라이빗 룸 접대 가능",
    };
    expect(placeSuitableForMeetingPrimary(dining)).toBe(true);
    expect(
      placeSuitableForMeetingCourse("강남 업무 미팅 1차", dining)
    ).toBe(true);
  });

  it("문래 3차 검색은 area·after·party phrase를 잡는다", () => {
    const query = "문래 친구들과 왁자지껄 3차 코스";
    const parsed = parseCourseQuery(query);
    expect(parsed.area).toBe("문래");
    expect(parsed.intents.after).toBe(true);
    expect(buildPartyCourseSearchPhrases(query, parsed)).toContain("문래 술집");
  });

  it("문래 코스 초안에서 용산·종로 장소를 제거한다", () => {
    const placeByKey = new Map([
      [
        "a",
        {
          name: "용산 포차",
          address: "서울 용산구 용산동1가",
          category: "술집",
        },
      ],
      [
        "b",
        {
          name: "문래 와인바",
          address: "서울 영등포구 문래동3가",
          category: "술집 > 와인",
        },
      ],
      [
        "c",
        {
          name: "종로2가 술집",
          address: "서울 종로구 종로2ga",
          category: "술집",
        },
      ],
    ]);
    expect(placeBelongsToCourseArea(placeByKey.get("a"), "문래")).toBe(false);
    expect(placeBelongsToCourseArea(placeByKey.get("b"), "문래")).toBe(true);
    expect(placeBelongsToCourseArea(placeByKey.get("c"), "문래")).toBe(false);

    const draft = sanitizeCourseDraftForArea(
      { area: "문래" },
      {
        steps: [
          { placeKey: "a", memo: "", visit_tip: "", stay_minutes: 0 },
          { placeKey: "b", memo: "", visit_tip: "", stay_minutes: 0 },
          { placeKey: "c", memo: "", visit_tip: "", stay_minutes: 0 },
        ],
      },
      placeByKey
    );
    expect(draft.steps.map((s) => s.placeKey)).toEqual(["b"]);
  });
});
