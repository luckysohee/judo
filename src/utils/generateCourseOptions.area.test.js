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
  {
    id: "mugyo-bar",
    name: "다동황소막창",
    address: "서울 중구 남대문로 60-5", // 무교동·다동 — 시청/청계천 옆, 종로 코어로 유지
    lat: 37.5673,
    lng: 126.9786,
  },
  {
    id: "namdaemun-market",
    name: "서령 본점",
    address: "서울 중구 남대문로5가 120", // 남대문시장 권역 — 제외
    lat: 37.5589,
    lng: 126.9745,
  },
  {
    id: "chungjeongno-bar",
    name: "옐로우보울",
    address: "서울특별시 서대문구 충정로3가 476", // 충정로/서대문 — 제외
    lat: 37.5631,
    lng: 126.9636,
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

  it("무교동·다동(남대문로 북쪽)은 유지", () => {
    expect(ids).toContain("mugyo-bar");
  });

  it("남대문시장·충정로(서남) 권역은 제외", () => {
    expect(ids).not.toContain("namdaemun-market");
    expect(ids).not.toContain("chungjeongno-bar");
  });
});

// 압구정 센터 (37.527, 127.028) — 강 건너 성수/잠원 오염 제거
const apgujeongPlaces = [
  {
    id: "apgujeong-core",
    name: "압구정 로데오집",
    address: "서울특별시 강남구 신사동 663", // 압구정·신사 권역
    lat: 37.5271,
    lng: 127.0285,
  },
  {
    id: "seongsu-river",
    name: "성수아구찜",
    address: "서울특별시 성동구 성수동1가 656-318", // 강 건너 성수 — 제외
    lat: 37.5447,
    lng: 127.0558,
  },
  {
    id: "jamwon-river",
    name: "포항집",
    address: "서울특별시 서초구 잠원동 8-7", // 강 건너 잠원 — 제외
    lat: 37.5145,
    lng: 127.018,
  },
];

describe("resolveCourseAreaPool - 압구정에 강 건너(성수·잠원) 오염 제거", () => {
  const { areaPlaces } = resolveCourseAreaPool(apgujeongPlaces, {
    area: "압구정",
    raw: "압구정 데이트 코스",
  });
  const ids = areaPlaces.map((p) => p.id);

  it("압구정·신사 코어는 포함", () => {
    expect(ids).toContain("apgujeong-core");
  });

  it("강 건너 성수(성동구)·잠원(서초구)은 제외", () => {
    expect(ids).not.toContain("seongsu-river");
    expect(ids).not.toContain("jamwon-river");
  });
});

// 강남 센터 (37.4979, 127.0276) — '강남구' 전역 통과 방지(도산·청담 먼 곳 제외)
const gangnamPlaces = [
  {
    id: "gangnam-core",
    name: "역삼 포차",
    address: "서울특별시 강남구 역삼동 825", // 강남역 코어
    lat: 37.4995,
    lng: 127.0301,
  },
  {
    id: "dosan-far",
    name: "다고바",
    address: "서울 강남구 도산대로99길 26", // 같은 강남구지만 압구정 권역(3.8km) — 제외
    lat: 37.5246,
    lng: 127.0407,
  },
  {
    id: "cheongdam-far",
    name: "새벽집 청담본점",
    address: "서울 강남구 청담동 129-10", // 청담 — 제외
    lat: 37.5258,
    lng: 127.0466,
  },
];

describe("resolveCourseAreaPool - 강남이 '강남구' 전역으로 새지 않음", () => {
  const { areaPlaces } = resolveCourseAreaPool(gangnamPlaces, {
    area: "강남",
    raw: "강남 데이트 코스",
  });
  const ids = areaPlaces.map((p) => p.id);

  it("강남역 코어(역삼)는 포함", () => {
    expect(ids).toContain("gangnam-core");
  });

  it("도산대로·청담(같은 강남구지만 먼 압구정 권역)은 제외", () => {
    expect(ids).not.toContain("dosan-far");
    expect(ids).not.toContain("cheongdam-far");
  });
});

// 이태원 센터 (37.5319, 127.0008) — 같은 용산구지만 삼각지·신용산(용산동)은 이태원 아님
const itaewonPlaces = [
  {
    id: "itaewon-core",
    name: "이태원숯불구이",
    address: "서울특별시 용산구 이태원동 44-13",
    lat: 37.5345,
    lng: 126.9945,
  },
  {
    id: "hannam-core",
    name: "한남댁",
    address: "서울 용산구 한남대로21길 32",
    lat: 37.5345,
    lng: 127.0045,
  },
  {
    id: "yongsandong-samgakji",
    name: "해물점 용산 직영점",
    address: "서울특별시 용산구 용산동3가 1-67", // 삼각지/신용산 — 같은 용산구지만 제외
    lat: 37.5345,
    lng: 126.9725,
  },
];

describe("resolveCourseAreaPool - 이태원에 삼각지·용산(용산동) 오염 제거", () => {
  const { areaPlaces } = resolveCourseAreaPool(itaewonPlaces, {
    area: "이태원",
    raw: "이태원 데이트 코스",
  });
  const ids = areaPlaces.map((p) => p.id);

  it("이태원·한남 코어는 포함", () => {
    expect(ids).toContain("itaewon-core");
    expect(ids).toContain("hannam-core");
  });

  it("삼각지·신용산(용산동)은 같은 용산구라도 제외", () => {
    expect(ids).not.toContain("yongsandong-samgakji");
  });
});

describe("resolveCourseAreaPool - 지역 매칭 0건이면 전체 풀로 완화", () => {
  it("엉뚱한 area면 area를 해제하고 places 전체를 반환", () => {
    const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(places, {
      area: "존재하지않는동네XYZ",
      raw: "존재하지않는동네XYZ 코스",
      steps: 2,
    });
    expect(areaPlaces).toHaveLength(places.length);
    expect(effectiveParsed.area).toBeUndefined();
    expect(effectiveParsed.steps).toBe(2);
  });
});

describe("resolveCourseAreaPool - 충무로에 다동·무교 오염 제거", () => {
  const chungmuroPlaces = [
    {
      id: "chungmuro-core",
      name: "충무로 노포",
      address: "서울특별시 중구 충무로2가",
      lat: 37.5612,
      lng: 126.994,
    },
    {
      id: "pildong-core",
      name: "필동 막걸리",
      address: "서울특별시 중구 필동2가",
      lat: 37.5605,
      lng: 126.9955,
    },
    {
      id: "dadong-far",
      name: "다동 황소막창",
      address: "서울 중구 다동 123",
      lat: 37.5672,
      lng: 126.9828,
    },
    {
      id: "mugyo-far",
      name: "무교동 포차",
      address: "서울 중구 무교동 1",
      lat: 37.5678,
      lng: 126.9785,
    },
  ];

  const { areaPlaces } = resolveCourseAreaPool(chungmuroPlaces, {
    area: "충무로",
    raw: "충무로 노포 술집 코스",
  });
  const ids = areaPlaces.map((p) => p.id);

  it("충무로·필동은 포함", () => {
    expect(ids).toContain("chungmuro-core");
    expect(ids).toContain("pildong-core");
  });

  it("다동·무교(시청 쪽)는 제외", () => {
    expect(ids).not.toContain("dadong-far");
    expect(ids).not.toContain("mugyo-far");
  });

  it("을지로3가 상호·주소는 제외, 초동은 포함", () => {
    const withEuljiro = [
      ...chungmuroPlaces,
      {
        id: "deepin-euljiro3",
        name: "디핀 을지로3가",
        address: "서울 중구 을지로3가",
        lat: 37.5663,
        lng: 126.991,
      },
      {
        id: "chungmuro-addr-but-euljiro-coords",
        name: "충무로간판술집",
        address: "서울 중구 충무로3가",
        lat: 37.5663,
        lng: 126.991,
      },
      {
        id: "euljiro-coords-only",
        name: "아무술집",
        address: "서울 중구",
        lat: 37.5663,
        lng: 126.991,
      },
      {
        id: "chodong-ok",
        name: "초동 포차",
        address: "서울 중구 초동",
        lat: 37.5645,
        lng: 126.995,
      },
      {
        id: "station-core-no-token",
        name: "역앞 호프",
        address: "서울 중구",
        lat: 37.5614,
        lng: 126.9942,
      },
    ];
    const { areaPlaces: pool } = resolveCourseAreaPool(withEuljiro, {
      area: "충무로",
      raw: "충무로 노포 술집 코스",
    });
    const poolIds = pool.map((p) => p.id);
    expect(poolIds).not.toContain("deepin-euljiro3");
    expect(poolIds).not.toContain("chungmuro-addr-but-euljiro-coords");
    expect(poolIds).not.toContain("euljiro-coords-only");
    expect(poolIds).toContain("chodong-ok");
    expect(poolIds).toContain("station-core-no-token");
  });
});

describe("resolveCourseAreaPool - 충무로 0건일 때 전체 풀로 풀지 않음", () => {
  it("역 반경 밖·을지로만 있으면 빈 배열 (을지로 재유입 금지)", () => {
    const onlyEuljiro = [
      {
        id: "deepin",
        name: "디핀 을지로3가",
        address: "서울 중구 을지로3가",
        lat: 37.5663,
        lng: 126.991,
      },
      {
        id: "chungmuro-label-far",
        name: "충무로간판",
        address: "서울 중구 충무로4가",
        lat: 37.5665,
        lng: 126.9905,
      },
    ];
    const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(onlyEuljiro, {
      area: "충무로",
      raw: "충무로 노포 술집 코스",
      steps: 2,
    });
    expect(areaPlaces).toHaveLength(0);
    expect(effectiveParsed.area).toBe("충무로");
  });
});
