import { describe, expect, it } from "vitest";
import { regenerateSecondStep } from "./regenerateSecondStep.js";
import { parseCourseQuery } from "./parseCourseQuery.js";

function steerPlace(id, name, category, lat, lng) {
  return {
    id,
    name,
    place_name: name,
    category,
    categories: [category],
    category_name: `음식점 > ${category}`,
    address: "서울 성동구 성수동",
    region: "성수",
    lat,
    lng,
    y: lat,
    x: lng,
    tags: ["데이트", "분위기"],
    vibes: ["분위기좋은"],
    // 주종 토큰을 비워 카테고리 우선 가산만 비교
    liquor_types: [],
    liquorTypes: [],
    curator_count: 1,
    overlap_curator_count: 0,
  };
}

function buildSelectedCourse(firstPlace) {
  return {
    key: "test-course",
    profileKey: "normal",
    profileTitle: "테스트",
    profileDescription: "테스트 코스",
    steps: [
      { step: 1, label: "1차", stayMinutes: 90, place: firstPlace },
      {
        step: 2,
        label: "2차",
        stayMinutes: 60,
        place: steerPlace("seed", "기존 2차", "바", 37.5448, 127.0556),
      },
    ],
  };
}

describe("regenerateSecondStep 주종→음식 카테고리 우선", () => {
  const parsed = parseCourseQuery("성수 데이트 코스");
  const firstPlace = steerPlace("first", "성수 1차 식당", "양식", 37.544, 127.055);

  const chinese = steerPlace("cn", "성수 중식당", "중식당", 37.5452, 127.0562);
  const korean = steerPlace("kr", "성수 모던한식", "한식", 37.5453, 127.0563);

  const places = [firstPlace, chinese, korean];
  const selectedCourse = buildSelectedCourse(firstPlace);

  it("고량주 선택 시 중식당이 모던 한식보다 위로 온다", () => {
    const results = regenerateSecondStep({
      selectedCourse,
      parsedQuery: parsed,
      places,
      userSecondPreferences: {
        liquorTypes: ["고량주"],
        maxSecondDistanceM: 2000,
      },
    });
    const names = results.map((c) => c.steps[c.steps.length - 1].place.name);
    expect(names).toContain("성수 중식당");
    expect(names.indexOf("성수 중식당")).toBeLessThan(
      names.indexOf("성수 모던한식")
    );
    expect(results.every((c) => c.liquorSteerRequested)).toBe(true);
    const chineseCourse = results.find(
      (c) => c.steps[c.steps.length - 1].place.name === "성수 중식당"
    );
    expect(chineseCourse.liquorCategoryMatched).toBe(true);
  });

  it("주종 맞춤이 없으면 liquorSteerRequested는 true, liquorCategoryMatched는 false", () => {
    const noMatch = steerPlace("bar", "성수 그냥바", "바", 37.5452, 127.0562);
    const results = regenerateSecondStep({
      selectedCourse: buildSelectedCourse(firstPlace),
      parsedQuery: parsed,
      places: [firstPlace, noMatch],
      userSecondPreferences: {
        liquorTypes: ["고량주"],
        maxSecondDistanceM: 2000,
      },
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.liquorSteerRequested)).toBe(true);
    expect(results.some((c) => c.liquorCategoryMatched)).toBe(false);
  });

  it("막걸리·전통주 선택 시 모던 한식이 중식당보다 위로 온다", () => {
    const results = regenerateSecondStep({
      selectedCourse,
      parsedQuery: parsed,
      places,
      userSecondPreferences: {
        liquorTypes: ["막걸리", "전통주"],
        maxSecondDistanceM: 2000,
      },
    });
    const names = results.map((c) => c.steps[c.steps.length - 1].place.name);
    expect(names).toContain("성수 모던한식");
    expect(names.indexOf("성수 모던한식")).toBeLessThan(
      names.indexOf("성수 중식당")
    );
  });
});
