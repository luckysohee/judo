import { describe, expect, it } from "vitest";
import {
  filterByArea,
  generateCourseOptions,
} from "./generateCourseOptions.js";
import { parseCourseQuery } from "./parseCourseQuery.js";

function mockPlace(id, name, category, lat, lng, extra = {}) {
  return {
    id,
    name,
    place_name: name,
    category,
    categories: [category],
    category_name: category,
    address: "서울 성동구 성수동",
    region: "성수",
    lat,
    lng,
    y: lat,
    x: lng,
    tags: extra.tags ?? ["데이트", "분위기"],
    vibes: extra.vibes ?? ["분위기좋은", "조용한"],
    liquor_types: extra.liquor_types ?? ["와인"],
    liquorTypes: extra.liquor_types ?? ["와인"],
    curator_count: extra.curator_count ?? 2,
    overlap_curator_count: extra.overlap_curator_count ?? 0,
  };
}

describe("generateCourseOptions diversity", () => {
  it("성수 데이트 코스 3장이 서로 다른 1차 식당을 쓰는 경우가 많다", () => {
    const places = [
      mockPlace("p1", "성수 와인A", "와인바", 37.544, 127.055),
      mockPlace("p2", "성수 이자카야B", "이자카야", 37.545, 127.056),
      mockPlace("p3", "성수 다이닝C", "양식", 37.543, 127.054),
      mockPlace("p4", "성수 바D", "바", 37.546, 127.057),
      mockPlace("p5", "성수 한식E", "한식", 37.542, 127.053),
      mockPlace("p6", "성수 와인F", "와인바", 37.547, 127.058),
      mockPlace("p7", "성수 카페G", "카페", 37.541, 127.052),
      mockPlace("p8", "성수 칵테일H", "바", 37.548, 127.059),
    ];

    const parsed = parseCourseQuery("성수 데이트 코스");
    const options = generateCourseOptions({
      parsedQuery: parsed,
      places,
      maxOptions: 3,
    });

    expect(options.length).toBeGreaterThanOrEqual(2);
    const firstKeys = options
      .map((c) => c?.steps?.[0]?.place?.id)
      .filter(Boolean);
    expect(new Set(firstKeys).size).toBe(firstKeys.length);
  });

  it("연남동 데이트 코스는 홍대 클러스터에 연남 장소를 포함한다", () => {
    const parsed = parseCourseQuery("연남동 데이트 코스");
    expect(parsed.area).toBe("홍대");

    const yeonnamMeal = mockPlace(
      "y1",
      "연남 비스트로",
      "양식",
      37.5612,
      126.9228,
      {
        tags: ["데이트", "식사가능"],
        address: "서울 마포구 연남동",
        region: "연남",
      }
    );
    const yeonnamBar = mockPlace(
      "y2",
      "연남 와인바",
      "와인바",
      37.5615,
      126.923,
      {
        tags: ["데이트", "2차"],
        address: "서울 마포구 연남동",
        region: "연남",
      }
    );
    const yeonnamBar2 = mockPlace(
      "y3",
      "연남 바",
      "바",
      37.5618,
      126.9235,
      {
        tags: ["2차", "분위기"],
        address: "서울 마포구 연남동",
        region: "연남",
      }
    );
    const yeonnamMeal2 = mockPlace(
      "y4",
      "연남 이자카야",
      "이자카야",
      37.5608,
      126.9225,
      {
        tags: ["데이트"],
        address: "서울 마포구 연남동",
        region: "연남",
      }
    );
    const places = [yeonnamMeal, yeonnamBar, yeonnamBar2, yeonnamMeal2];
    const inArea = filterByArea(places, "홍대");
    expect(inArea.length).toBe(4);

    const options = generateCourseOptions({
      parsedQuery: parsed,
      places,
      maxOptions: 3,
    });
    expect(options.length).toBeGreaterThanOrEqual(1);
  });
});
