import { describe, expect, it } from "vitest";
import { resolveCourseAreaPool } from "./generateCourseOptions.js";

// 을지로 센터 (37.566, 126.991) 기준
const places = [
  {
    id: "core-euljiro",
    name: "을지로 노가리집",
    address: "서울특별시 중구 을지로3가",
    lat: 37.5662,
    lng: 126.9905,
  },
  {
    id: "myeongdong-core",
    name: "명동 칼국수",
    address: "서울특별시 중구 명동",
    lat: 37.5636,
    lng: 126.985,
  },
  {
    id: "yaksu-far",
    name: "약수 곱창",
    address: "서울특별시 중구 다산로 33", // 약수동인데 '다산로'로만 저장된 케이스
    lat: 37.5544,
    lng: 127.0107,
  },
  {
    id: "gwanghwamun-far",
    name: "광화문 한정식",
    address: "서울특별시 종로구 세종대로",
    lat: 37.5715,
    lng: 126.9769,
  },
  {
    id: "dongdaemun-synonym",
    name: "동대문 포차",
    address: "서울특별시 중구 을지로6가", // 을지로 동의어 포함 → 경계지만 유지
    lat: 37.5714,
    lng: 127.0098,
  },
];

describe("resolveCourseAreaPool - 을지로 인접지 오염 제거", () => {
  const { areaPlaces } = resolveCourseAreaPool(places, {
    area: "을지로",
    raw: "을지로 데이트 코스",
  });
  const ids = areaPlaces.map((p) => p.id);

  it("을지로·명동 코어는 포함", () => {
    expect(ids).toContain("core-euljiro");
    expect(ids).toContain("myeongdong-core");
  });

  it("약수(다산로)·광화문은 거리/토큰으로 제외", () => {
    expect(ids).not.toContain("yaksu-far");
    expect(ids).not.toContain("gwanghwamun-far");
  });

  it("을지로 동의어가 박힌 경계 장소는 유지", () => {
    expect(ids).toContain("dongdaemun-synonym");
  });
});

// 종로 센터 (37.57, 126.979) 기준 — 용산구 숙대입구/남영 권역 오염 제거
const jongnoPlaces = [
  {
    id: "jongno-core",
    name: "서린낙지",
    address: "서울특별시 종로구 종로1가 24",
    lat: 37.5701,
    lng: 126.9803,
  },
  {
    id: "jongno5ga",
    name: "효제루",
    address: "서울특별시 종로구 효제동 301-2", // 종로구지만 센터에서 2km+ → 동의어(종로)로 유지
    lat: 37.5722,
    lng: 127.0,
  },
  {
    id: "sookdae-bar",
    name: "상록수연탄구이 숙대본점",
    address: "서울 용산구 청파동2가 99-2", // 숙대입구 — 제외 대상
    lat: 37.5455,
    lng: 126.9695,
  },
  {
    id: "namyeong-far",
    name: "남영돈",
    address: "서울특별시 용산구 남영동 52-2",
    lat: 37.5417,
    lng: 126.9716,
  },
];

describe("resolveCourseAreaPool - 종로에 용산구(숙대입구·남영) 오염 제거", () => {
  const { areaPlaces } = resolveCourseAreaPool(jongnoPlaces, {
    area: "종로",
    raw: "종로 데이트 코스",
  });
  const ids = areaPlaces.map((p) => p.id);

  it("종로 도심 코어는 포함", () => {
    expect(ids).toContain("jongno-core");
  });

  it("종로구 주소는 거리와 무관하게 유지", () => {
    expect(ids).toContain("jongno5ga");
  });

  it("용산구 숙대입구·남영 술집은 제외", () => {
    expect(ids).not.toContain("sookdae-bar");
    expect(ids).not.toContain("namyeong-far");
  });
});
