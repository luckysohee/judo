import { COURSE_PATTERNS } from "./coursePatterns.js";
import { COURSE_PROFILE_ORDER, COURSE_PROFILES } from "./courseProfiles.js";
import { haversineMeters, resolvePlaceWgs84 } from "./placeCoords.js";
import { courseWalkCrossesHanRiver } from "./courseRiverCrossing.js";
import {
  REGION_KEYWORDS,
  normalizeRegionClusterKey,
  filterPlacesByRegionProximity,
  getRegionCenterCoords,
} from "./searchParser.js";
import { getSeasonalMenuMismatchPenalty } from "./placeSeasonality.js";
import { getMinutesUntilClose, isPlaceOpenNow } from "./timeUtils.js";

function hashString(s) {
  let h = 5381;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/** 0..1 유사 균등 — 검색마다·프로필마다 다른 코스 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleHeadInCopy(arr, headLen, rng) {
  const out = [...arr];
  const n = Math.min(headLen, out.length);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)];
}

function tokensFromCategoryName(place) {
  const cn = place?.category_name;
  if (!cn || typeof cn !== "string") return [];
  return cn
    .split(/[>,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function placeCategories(place) {
  const fromArr = normalizeArray(place.categories);
  const fromCat = tokensFromCategoryName(place);
  return [...new Set([...fromArr, ...fromCat])];
}

function placeAreaHaystack(place) {
  return [
    place.areaName,
    place.region,
    place.address_name,
    place.road_address_name,
    place.address,
    place.place_name,
    place.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** 을지로 코스: 주소에 이 구가 있으면 상호만 «을지로»여도 제외(용산·영등포 등 오탐 방지) */
const EULJIRO_EXCLUDED_GU_MARKERS = [
  "성동구",
  "광진구",
  "강남구",
  "서초구",
  "송파구",
  "강동구",
  "마포구",
  "영등포구",
  "양천구",
  "구로구",
  "용산구",
];

/**
 * 동네 코스 풀 정합 — 좌표만 가깝거나 같은 구라서 섞이는 타 동네 제거.
 * 동네별로 { km: 코어 반경, allow: 이 동네에 속하는 구체 동/지명 토큰, deny: 무조건 제외 }.
 *
 * 핵심: 허용을 '구(區) 단위 동의어'가 아니라 '구체 동/지명'으로 둔다.
 * (예전엔 REGION_KEYWORDS의 강남구·서초구·용산구·송파 같은 광역 토큰이 escape로 쓰여
 *  같은 구 전체가 통과 → 청담/반포/숙대까지 새던 문제)
 * 판정: deny 매칭 → 제외 / allow 매칭 → 유지 / 둘 다 아니고 코어 반경 밖 → 제외.
 * 코스는 '걸어다닐' 권역이라 반경을 좁게(대략 1.2~2.8km) 둔다.
 */
const COURSE_AREA_CORE = {
  을지로: {
    km: 1.2,
    allow: [/을지로/, /충무로/, /명동/, /방산/, /입정동/, /산림동/, /주교동/, /수표/, /저동/, /초동/, /인현동/, /장교동/, /삼각동/, /수하동/, /다동/, /무교/, /동대문/],
    deny: [
      /광화문/, /세종로/, /신문로/, /안국|삼청동|인사동|익선동|경복궁|청운동/,
      /약수/, /신당/, /다산/, /청구/, /장충/,
      /동대문구|왕십리|성동구|용산구/,
    ],
  },
  종로: {
    km: 1.8,
    allow: [/종로/, /광화문/, /시청/, /청진동/, /관철동|관수동|관훈동/, /인사동/, /익선/, /낙원/, /돈화문|돈의동/, /삼청|가회|안국|소격/, /통인|체부|누상|누하|효자|창성|적선|내자|사직/, /다동/, /무교/, /효제|연지|예지/],
    deny: [
      /용산구/, /남영/, /숙대|숙명/, /청파/, /서계동/, /갈월/, /후암/, /신흥로/, /한강대로/,
      /신당|다산|약수/,
      /회현/, /남대문로[2-6]가|남대문시장/,
      /충정로/, /서대문/, /냉천동/, /창천동/, /영천|독립문/,
      /만리재|만리동|만리시장/, /중림/, /봉래|의주로|서소문|순화동/,
    ],
  },
  이태원: {
    km: 2.2,
    // 용산동2가·3가는 삼각지/신용산 권역(이태원 아님), 후암동은 남산 너머(2.9km) → allow 제외
    allow: [/이태원/, /한남/, /경리단/, /회나무/, /녹사평/, /보광/, /우사단/, /해방촌/],
    deny: [
      /서계동/, /청파/, /원효로/, /한강로/, /남영/, /숙대/, /갈월/, /서빙고/, /도원/, /효창/,
      // 삼각지·신용산·용산역 권역(용산동) — 같은 용산구라 거리만으론 안 잡힘
      /용산동/, /삼각지/, /신용산/, /용산역/, /문배|신계동/, /후암/,
      // 강 건너(강남·서초)·중구 동쪽(신당·약수)은 직선거리만 가까움
      /신사동|압구정|강남대로/, /잠원|반포/, /신당|약수/, /옥수|금호/, /삼성동|청담/,
    ],
  },
  홍대: {
    km: 2.2,
    allow: [/홍대/, /합정/, /상수/, /망원/, /연남/, /서교/, /동교/, /와우산/, /잔다리/],
    deny: [/공덕/, /도화동/, /용강/, /염리/, /아현/, /신수동/, /대흥동/],
  },
  성수: {
    km: 1.8,
    allow: [/성수/, /서울숲/, /뚝섬/, /성덕정/, /연무장/, /아차산로/],
    deny: [/청담/, /신사동/, /압구정/, /자양/, /구의/],
  },
  강남: {
    km: 2.8,
    // bare '강남'은 '강남구' 전역을 통과시켜(도산·선릉 3km+) 코어가 무력화됨 → 구체 토큰만.
    // 신사·도산·압구정로는 별도 '압구정' 권역 — 거리로 컷.
    allow: [/강남역/, /역삼/, /논현/, /테헤란/, /강남대로/, /신논현/],
    deny: [/청담/, /삼성동/, /대치/, /개포/, /양재/, /압구정/, /신사동/, /도산대로/, /선릉로1[0-9]/, /반포|잠원/],
  },
  압구정: {
    km: 1.8,
    allow: [/압구정/, /청담/, /신사/, /논현/, /도산/, /가로수/],
    deny: [/성수/, /서울숲/, /성동구/, /역삼/, /삼성동/, /옥수|금호/, /잠원|반포/, /한남|독서당/],
  },
  명동: {
    km: 1.4,
    allow: [
      /명동/,
      /회현/,
      /충무로/,
      /남대문로[1-9]길/,
      /소공동/,
      /북창동/,
      /태평로/,
      /저동/,
      /남산동/,
    ],
    deny: [
      /다동/,
      /무교/,
      /을지로입구/,
      /시청/,
      /세종대로/,
      /남영/,
      /숙대/,
      /갈월/,
      /용산구/,
      /한강대로/,
      /신당|약수|다산/,
    ],
  },
  충무로: {
    /**
     * 주소 «충무로N가»만으로 넣지 않음 — 충무로역 좌표 반경만 허용.
     * 을지로3가 ≈ 0.6km → km 0.5로 차단.
     */
    km: 0.5,
    stationCoreKm: 0.5,
    distanceFirst: true,
    allow: [
      /충무로/,
      /필동/,
      /인현/,
      /예장/,
      /초동/,
      /퇴계로/,
    ],
    deny: [
      /다동/,
      /무교/,
      /시청/,
      /세종대로/,
      /광화문/,
      /을지로/,
      /청계/,
      /명동/,
      /회현/,
      /저동/,
      /남산동/,
      /소공/,
      /북창/,
      /남영/,
      /숙대/,
      /갈월/,
      /용산구/,
      /신당|약수|다산/,
      /동대문역|동대문시장/,
    ],
  },
  신촌: {
    km: 1.8,
    allow: [/신촌/, /이대/, /대현/, /창천/, /연희/, /아현/, /노고산/, /대신동/, /봉원/, /합정|서교/, /공덕/],
    deny: [/홍대입구역/],
  },
  문정: {
    km: 1.8,
    allow: [/문정/, /가락/, /장지/, /법조/, /법원로/],
    deny: [/잠실/, /석촌/, /송파동/],
  },
  문래: {
    km: 1.6,
    allow: [/문래/, /문화촌/, /창작촌/, /영등포구/, /영등포/],
    deny: [
      /용산구/,
      /종로구/,
      /종로[1-6]가/,
      /을지로/,
      /여의도/,
      /당산동/,
      /양평동/,
      /마포구/,
      /합정/,
      /홍대/,
      /신길/,
      /대림/,
      /구로/,
      /가산/,
    ],
  },
  잠실: {
    km: 2.2,
    allow: [/잠실/, /석촌/, /송파동/, /방이/, /삼전/, /신천/, /잠실본동/, /올림픽로/],
    deny: [/문정/, /가락/, /법원로/, /삼성동/, /광나루/, /성내동/, /자양|구의/],
  },
  서초: {
    km: 2.2,
    allow: [/서초/, /서래/, /방배/, /교대/, /효령로/, /나루터로/],
    deny: [/반포/, /잠원/, /양재/, /역삼/, /올림픽대로/, /한강공원/],
  },
};

function placeHardExcludedFromArea(place, areaKey) {
  if (!areaKey) return false;
  const cfg = COURSE_AREA_CORE[areaKey];
  // 설정 없는 동네(부산·대구·제주 등)는 제외하지 않음(기존 동작 유지)
  if (!cfg) return false;

  const blob = placeAreaHaystack(place);

  // 1) 무조건 제외(인접 타 권역 토큰)
  if (cfg.deny?.some((re) => re.test(blob))) return true;

  const hasAllow = Boolean(cfg.allow?.some((re) => re.test(blob)));
  let distKm = null;
  if (cfg.km != null || cfg.stationCoreKm != null || cfg.distanceFirst) {
    const center = getRegionCenterCoords(areaKey);
    const w = resolvePlaceWgs84(place);
    if (center && w) {
      distKm = haversineMeters(center.lat, center.lng, w.lat, w.lng) / 1000;
    }
  }

  // 충무로역 등: 주소 토큰보다 역 좌표 반경이 우선 («충무로» 주소라도 을지로3가면 제외)
  if (cfg.distanceFirst) {
    const maxKm = cfg.km ?? cfg.stationCoreKm;
    if (distKm != null && maxKm != null) {
      return distKm > maxKm;
    }
    // 좌표 없을 때만 허용 동·지명으로 완화
    return !hasAllow;
  }

  // 2) 허용 동·지명 매칭 → 유지
  if (hasAllow) return false;

  // 3) stationCore: 토큰 없어도 역 바로 옆 좌표만 허용
  if (
    cfg.stationCoreKm != null &&
    distKm != null &&
    distKm <= cfg.stationCoreKm
  ) {
    return false;
  }

  // 4) 허용 토큰 필수 권역
  if (cfg.requireAllowToken) return true;

  // 5) 일반: 코어 반경 밖이면 제외
  if (cfg.km != null && distKm != null && distKm > cfg.km) return true;
  return false;
}

function placeMatchesArea(place, areaKey) {
  if (!areaKey) return true;
  const blob = placeAreaHaystack(place);
  const synonyms = REGION_KEYWORDS[areaKey];
  let matched = false;
  if (synonyms?.length) {
    const b = blob.toLowerCase();
    matched = synonyms.some((s) => {
      const sl = String(s).toLowerCase();
      if (!sl) return false;
      /** 「을지로」에 「종로」가 부분 문자열로 들어가 오매칭 — 종로구·종로N가·동명만 허용 */
      if (areaKey === "종로" && sl === "종로") {
        return (
          b.includes("종로구") ||
          /종로[1-6]가|삼청|안국|청운|광화문|세종대로|경복궁|신문로/.test(b)
        );
      }
      return b.includes(sl);
    });
  } else {
    matched = blob.includes(String(areaKey).toLowerCase());
  }
  if (
    !matched &&
    place.region &&
    normalizeRegionClusterKey(place.region) ===
      normalizeRegionClusterKey(areaKey)
  ) {
    matched = true;
  }
  if (!matched) return false;
  if (areaKey === "문정") {
    const b = blob.toLowerCase();
    if (
      /잠실|석촌|신천|방이|올림픽|롯데월드|송파구\s*잠실/.test(b) &&
      !b.includes("문정") &&
      !b.includes("가락") &&
      !b.includes("장지")
    ) {
      return false;
    }
  }
  if (areaKey === "문래") {
    const b = blob.toLowerCase();
    if (
      (/용산|종로구|종로[1-6]|을지로|여의|신용산|삼각지/.test(b) ||
        /서울\s*중구|서울특별시\s*중구/.test(b)) &&
      !/문래|문화촌|창작촌/.test(b)
    ) {
      return false;
    }
  }
  if (areaKey === "을지로" || areaKey === "동대문" || areaKey === "혜화") {
    const b = blob.toLowerCase();
    if (
      EULJIRO_EXCLUDED_GU_MARKERS.some((g) =>
        b.includes(String(g).toLowerCase())
      )
    ) {
      return false;
    }
  }
  return true;
}

function includesAny(source, target) {
  if (!source.length || !target.length) return false;
  const set = new Set(source.map((x) => String(x).toLowerCase()));
  return target.some((t) => set.has(String(t).toLowerCase()));
}

/**
 * 코스 룰의 category 토큰(포차·해산물 등)과 장소 매칭.
 * 카카오 `음식점 > 포장마차`, `횟집` 등은 완전일치만으로는 누락되므로 동의어·부분문자열 사용.
 */
const RULE_CATEGORY_NEEDLES = {
  포차: ["포차", "포장마차", "포장"],
  술집: ["술집", "주점", "호프", "노가리"],
  해산물: [
    "해산물",
    "횟집",
    "생선회",
    "모둠회",
    "물회",
    "회덮밥",
    "해물",
    "조개",
    "새우",
    "낙지",
    "문어",
    "게장",
    "회집",
    "사시미",
    "오마카세",
    "스시",
    "초밥",
    "활어",
    "수산",
  ],
  이자카야: ["이자카야"],
  와인바: ["와인바", "와인"],
  바: [
    "pub",
    "펍",
    "칵테일",
    "칵테일바",
    "와이드바",
    "위스키",
    "위스키바",
    "whisky",
    "whiskey",
    "싱글몰트",
    "하이볼",
  ],
  한식: ["한식", "한정식", "백반"],
  고깃집: ["고깃집", "삼겹살", "갈비", "육류", "고기"],
  식사: ["식사", "음식점", "식당", "레스토랑"],
  육류: ["육류", "고기", "삼겹살", "갈비", "스테이크"],
  고기: ["고기", "고깃집", "삼겹살", "갈비", "육류"],
  양식: ["양식", "이탈리", "프렌치", "파스타", "스테이크"],
  다이닝: ["다이닝", "파인", "코스"],
  카페: [
    "카페",
    "커피",
    "coffee",
    "café",
    "cafe",
    "라떼",
    "에스프레소",
    "로스터",
    "브루잉",
    "티룸",
    "tea",
    "디저트카페",
    "베이커리카페",
  ],
  디저트: [
    "디저트",
    "아이스크림",
    "소프트",
    "젤라또",
    "gelato",
    "빙수",
    "팥빙수",
    "설빙",
    "케이크",
    "타르트",
    "도넛",
    "도너츠",
    "베이커리",
    "브레드",
    "빵",
    "와플",
    "크로플",
    "크로와상",
    "마카롱",
    "초콜릿",
    "chocolate",
    "dessert",
    "프라페",
    "스무디",
    "밀크티",
    "버블티",
    "요거트",
    "froyo",
    "frozen",
    "파르페",
    "parfait",
    "티라미수",
    "빙과",
    "스콘",
    "macaron",
    "녹차",
    "말차",
    "matcha",
    "팥죽",
    "호떡",
    "붕어빵",
    "츄러스",
    "츄로",
  ],
  칵테일: ["칵테일", "칵테일바"],
};

function coursePlaceMatchesRuleCategories(place, ruleCategories) {
  if (!Array.isArray(ruleCategories) || !ruleCategories.length) return false;
  const tokens = placeCategories(place).map((c) => String(c).toLowerCase());
  const catHay = [...tokens, String(place.category_name || "").toLowerCase()]
    .join(" ")
    .trim();
  const nameHay = `${String(place.name || "").toLowerCase()} ${String(
    place.place_name || ""
  ).toLowerCase()}`.trim();
  const fullHay = `${catHay} ${nameHay}`;

  for (const rc of ruleCategories) {
    const rcl = String(rc).toLowerCase();
    if (includesAny(placeCategories(place), [rc])) return true;

    if (rcl === "바") {
      if (tokens.includes("바")) return true;
      if (
        fullHay.includes("pub") ||
        fullHay.includes("펍") ||
        fullHay.includes("칵테일")
      ) {
        return true;
      }
      continue;
    }

    const needles = RULE_CATEGORY_NEEDLES[rcl] || [rc];
    for (const n of needles) {
      const nl = String(n).toLowerCase();
      if (!nl) continue;
      if (nl.length <= 2) {
        if (catHay.includes(nl)) return true;
      } else if (fullHay.includes(nl)) return true;
    }
  }
  return false;
}

function coursePartySizeFitScore(place, partySize) {
  const n = Number(partySize);
  if (!Number.isFinite(n) || n <= 0) return 0;

  const tokens = placeCategories(place).map((c) => String(c).toLowerCase());
  const tags = normalizeArray(place.tags).map((t) => String(t).toLowerCase());
  const hay = `${tokens.join(" ")} ${tags.join(" ")} ${String(
    place?.name || place?.place_name || ""
  ).toLowerCase()} ${String(place?.category_name || "").toLowerCase()}`;

  const hasAny = (arr) => arr.some((k) => hay.includes(k));
  const groupLike = hasAny([
    "포차",
    "주점",
    "호프",
    "pub",
    "펍",
    "고깃집",
    "고기",
    "한식",
    "단체",
    "룸",
    "회식",
    "테이블",
  ]);
  const dateLike = hasAny([
    "와인",
    "칵테일",
    "데이트",
    "바",
    "이자카야",
    "무드",
    "조용",
    "다이닝",
  ]);

  if (n >= 5) {
    if (groupLike) return 16;
    if (dateLike) return -8;
    return 0;
  }
  if (n >= 3) {
    if (groupLike) return 10;
    if (dateLike) return -3;
    return 0;
  }
  if (n === 2) {
    if (dateLike) return 8;
    if (groupLike) return -2;
    return 0;
  }
  return 0;
}

function isBridgeCourseRule(rule) {
  return String(rule?.label || "") === "쩜오차";
}

/**
 * `categories` 배열이 비어 있어도 상호·카카오 카테고리·태그에 카페/디저트 토큰이 있으면 쩜오차 후보.
 * (규칙 `coursePlaceMatchesRuleCategories` 와 동일한 바늘 목록을 문자열 전체에 적용)
 */
function placeLooksLikeBridgeSweetStop(place) {
  const parts = [
    place?.name,
    place?.place_name,
    place?.category_name,
    ...(Array.isArray(place?.tags) ? place.tags : []),
    ...(Array.isArray(place?.categories) ? place.categories : []),
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  if (!parts.length) return false;
  const blob = parts.join(" ").toLowerCase();
  if (!blob) return false;
  for (const rc of ["카페", "디저트"]) {
    const needles = RULE_CATEGORY_NEEDLES[rc] || [rc];
    for (const n of needles) {
      const nl = String(n).toLowerCase();
      if (nl.length >= 2 && blob.includes(nl)) return true;
    }
  }
  return false;
}

/**
 * 쩜오차(달달 구간) 후보에서 제외: 저가 대형 커피 체인. 상호·카테고리 문자열 기준.
 */
export function isBudgetChainBridgeCoffeePlace(place) {
  const raw = String(place?.name || place?.place_name || "").toLowerCase();
  const cat = String(place?.category_name || "").toLowerCase();
  const blob = `${raw} ${cat}`.replace(/\s+/g, " ").trim();
  if (!blob) return false;
  if (/메가\s*mgc|메가mgc|mgc\s*커피|메가\s*커피|메가커피/.test(blob)) return true;
  if (/이디야|이디아/.test(blob)) return true;
  if (/매머드|메머드/.test(blob)) return true;
  if (/컴포즈/.test(blob)) return true;
  if (/빽다방/.test(blob)) return true;
  if (/요거프레소/.test(blob)) return true;
  if (/토프레소/.test(blob)) return true;
  if (/카페봄봄/.test(blob)) return true;
  if (/달콤\s*커피|달콤커피/.test(blob)) return true;
  if (/바나프레소/.test(blob)) return true;
  if (/커피에\s*반하다|커피에반하다/.test(blob)) return true;
  if (/더벤티/.test(blob)) return true;
  if (/커피\s*마마|커피마마/.test(blob)) return true;
  return false;
}

function countMatches(source, target) {
  if (!source.length || !target.length) return 0;
  const set = new Set(target.map((t) => String(t).toLowerCase()));
  return source.filter((item) => set.has(String(item).toLowerCase())).length;
}

export function placeId(place) {
  if (!place || typeof place !== "object") return null;
  return place.id ?? place.place_id ?? place.kakao_place_id ?? null;
}

/** 카카오 숫자 장소 id (DB·정규화 행 중복 구분) */
function kakaoVenueId(place) {
  if (!place || typeof place !== "object") return null;
  const raw = place._raw && typeof place._raw === "object" ? place._raw : null;
  const k =
    place.kakao_place_id ??
    place.kakaoId ??
    raw?.kakao_place_id ??
    raw?.kakaoId ??
    null;
  if (k == null || k === "") return null;
  const s = String(k).trim();
  return /^\d+$/.test(s) ? s : null;
}

function normalizePlaceName(place) {
  return String(place?.name || place?.place_name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** 코스 1차≠2차: id·카카오id·(이름+초근접) 동일 제외 + 최소 거리 */
const SECOND_MIN_DISTANCE_METERS = 35;
const SAME_NAME_MAX_DISTANCE_METERS = 80;

export function isSameVenueForCourseStep(first, second) {
  const id1 = placeId(first);
  const id2 = placeId(second);
  if (id1 != null && id2 != null && String(id1) === String(id2)) {
    return true;
  }

  const k1 = kakaoVenueId(first);
  const k2 = kakaoVenueId(second);
  if (k1 && k2 && k1 === k2) return true;

  const d = haversineMeters(
    Number(first.lat),
    Number(first.lng),
    Number(second.lat),
    Number(second.lng)
  );
  if (!Number.isFinite(d)) return true;

  const n1 = normalizePlaceName(first);
  const n2 = normalizePlaceName(second);
  if (n1 && n2 && n1 === n2 && d < SAME_NAME_MAX_DISTANCE_METERS) {
    return true;
  }

  return false;
}

/** 1차·2차(또는 1·쩜오차·2) 장소 id 조합 (프로필 무관 — 이미 본 조합 제외용) */
export function courseVenuePairKey(course) {
  const steps = course?.steps || [];
  if (steps.length >= 3) {
    const ids = steps
      .map((s) => placeId(s?.place))
      .filter((x) => x != null)
      .map(String);
    if (ids.length >= 3) return ids.join("|");
  }
  const p0 = course?.steps?.[0]?.place;
  const p1 = course?.steps?.[1]?.place;
  const a = placeId(p0);
  const b = placeId(p1);
  if (a == null || b == null) return null;
  return `${String(a)}|${String(b)}`;
}

/** 프로필 간 중복 코스 방지용 키 */
export function courseVenueDedupeKey(place) {
  const k = kakaoVenueId(place);
  if (k) return `kakao:${k}`;
  const id = placeId(place);
  if (id != null) return `id:${String(id)}`;
  const w = resolvePlaceWgs84(place);
  const nm = normalizePlaceName(place);
  if (w && nm) {
    return `geo:${nm}:${w.lat.toFixed(5)}:${w.lng.toFixed(5)}`;
  }
  if (w) return `pt:${w.lat.toFixed(5)}:${w.lng.toFixed(5)}`;
  return null;
}

function venueKeysForCourse(course) {
  const keys = [];
  for (const step of course?.steps || []) {
    const k = courseVenueDedupeKey(step.place);
    if (k) keys.push(k);
  }
  return keys;
}

function firstVenueKeyForCourse(course) {
  return courseVenueDedupeKey(course?.steps?.[0]?.place);
}

/** 지명 코스(성수·을지로 등) — 상위 후보·셔플·2차 랜덤 폭을 넓혀 같은 1차만 반복되는 현상 완화 */
function courseBuildPoolSizes(parsedQuery) {
  const namedArea = Boolean(parsedQuery?.area);
  return {
    rankedFirstCap: namedArea ? 36 : 22,
    firstShuffleCap: namedArea ? 18 : 12,
    legPickCap: namedArea ? 10 : 6,
  };
}

function shuffleCopyInPlace(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/** 같은 1차 식당으로 여러 코스가 쏠리지 않게 — 1차당 최고 점수 1개만 남김 */
function dedupeCoursesByFirstVenue(courses) {
  const byFirst = new Map();
  for (const c of courses || []) {
    const fk = firstVenueKeyForCourse(c);
    if (!fk) continue;
    const prev = byFirst.get(fk);
    if (!prev || (c.totalScore || 0) > (prev.totalScore || 0)) {
      byFirst.set(fk, c);
    }
  }
  return [...byFirst.values()].sort(
    (a, b) => (b.totalScore || 0) - (a.totalScore || 0)
  );
}

function pickFromRankedBand(candidates, cap, rng) {
  if (!candidates?.length) return null;
  const n = Math.min(cap, candidates.length);
  const band = candidates.slice(0, n);
  return band[Math.floor(rng() * band.length)];
}

/** 쩜오차용 카카오 보강만 합칠 때 — 1·2차 풀과 venue 키 기준 중복 제거 */
function mergePlaceListsDedupingVenues(primary, extra) {
  const map = new Map();
  const push = (p) => {
    const k = courseVenueDedupeKey(p);
    if (!k) return;
    if (!map.has(k)) map.set(k, p);
  };
  for (const p of primary || []) push(p);
  for (const p of extra || []) push(p);
  return [...map.values()];
}

const DEFAULT_PROFILE = COURSE_PROFILES.normal;

/**
 * @param {object} [parsedQuery]
 * @param {object} [profile]
 */
export function calculateCoursePlaceScore(
  place,
  rule,
  parsedQuery = {},
  profile = DEFAULT_PROFILE
) {
  const w = profile.weights;
  const vibes = normalizeArray(place.vibes);
  const liquorTypes = normalizeArray(place.liquorTypes ?? place.liquor_types);
  const tags = normalizeArray(place.tags);

  let score = 0;
  if (coursePlaceMatchesRuleCategories(place, rule.categories))
    score += 30 * w.category;
  if (includesAny(vibes, rule.vibes)) score += 20 * w.vibe;
  if (includesAny(liquorTypes, rule.liquorTypes)) score += 15 * w.liquor;

  const tagMatchCount = countMatches(tags, rule.tags);
  score += Math.min(tagMatchCount * 5, 20) * w.tag;

  const cur = Number(place.curatorCount ?? place.curator_count);
  if (Number.isFinite(cur)) score += Math.min(cur * 2, 20) * w.curator;

  const ov = Number(place.overlapCuratorCount ?? place.overlap_curator_count);
  if (Number.isFinite(ov)) score += Math.min(ov * 4, 18) * w.overlap;

  const openNow = isPlaceOpenNow(place);
  const minutesUntilClose = getMinutesUntilClose(place);

  if (openNow === true) score += 12 * w.openNow;

  if (parsedQuery.rightNow && openNow === false) {
    score -= 100;
  }

  if (parsedQuery.rightNow && minutesUntilClose != null) {
    if (minutesUntilClose < 40) score -= 60;
    else if (minutesUntilClose < 70) score -= 25;
    else if (minutesUntilClose >= (rule.stayMinutes ?? 60)) score += 8;
  }

  const partyFit = coursePartySizeFitScore(place, parsedQuery.partySize);
  if (partyFit !== 0) {
    score += partyFit;
  }

  /** 쩜오차: DB 카테고리 배열이 빈 카페·디저트가 많아 규칙 매칭만으론 0점으로 빠지는 경우 보강 */
  if (
    isBridgeCourseRule(rule) &&
    score < 12 &&
    placeLooksLikeBridgeSweetStop(place)
  ) {
    score += 28 * w.category;
  }

  score += getSeasonalMenuMismatchPenalty(place, {
    rawQuery: parsedQuery?.raw ?? parsedQuery?.query ?? "",
    parsedResult: parsedQuery,
  });

  return score;
}

function withResolvedCoords(place) {
  const w = resolvePlaceWgs84(place);
  if (!w) return null;
  return { ...place, lat: w.lat, lng: w.lng };
}

export function filterByArea(places, area) {
  if (!area) return places;
  return places.filter((p) => placeMatchesArea(p, area));
}

/**
 * 주소에 "을지로" 토큰이 없어도 `서울 중구` 등으로만 저장된 장소가 많아 `REGION_KEYWORDS`만 쓰면 0건 →
 * `area`를 버리고 전국(또는 넓은 반경) 풀로 코스를 짜 성동·강남 등이 섞이는 문제를 막음.
 * 짧은 단어만 쓰지 않음(부산 중구 등 오탐 방지).
 */
const COURSE_AREA_FALLBACK_PHRASES = {
  문정: [
    "서울특별시 송파구 문정",
    "서울 송파구 문정",
    "송파구 문정",
    "문정동",
    "문정역",
    "문정로",
    "가락동",
    "가락시장",
    "장지동",
  ],
  문래: [
    "서울특별시 영등포구",
    "서울 영등포구",
    "영등포구",
    "문래동",
    "문래동3가",
    "문래동4가",
    "문래동5가",
    "문래동6가",
    "문화촌",
    "문래창작촌",
  ],
  동대문: [
    "창신동",
    "숭인동",
    "동묘동",
    "동대문역",
    "동대문시장",
    "동대문디자인플라자",
    "ddp",
    "장충동",
    "광희동",
    "신당동",
    "서울특별시 중구 장충",
    "서울 중구 장충",
  ],
  혜화: [
    "혜화동",
    "혜화로",
    "대학로",
    "이화동",
    "명륜1가",
    "명륜2가",
    "명륜3가",
    "서울 종로구 혜화",
    "서울특별시 종로구 혜화",
    "마로니에",
  ],
  종로: [
    "서울특별시 종로구",
    "서울 종로구",
    "종로구",
    "안국동",
    "삼청동",
    "청운동",
    "신문로",
    "경복궁",
  ],
  홍대: [
    "서울 마포구",
    "서울특별시 마포구",
    "마포구",
    "연남동",
    "연남",
    "합정동",
    "합정",
    "망원동",
    "망원",
    "상수동",
    "상수",
    "서교동",
    "홍대입구",
    "서강대",
    "경의선숲길",
  ],
  을지로: [
    "을지로동",
    "을지로1가",
    "을지로2가",
    "을지로3가",
    "을지로4가",
    "을지로5가",
    "을지로6가",
    "을지로7가",
    "남대문로",
    "세종대로",
    "소공동",
    "회현동",
    "다동",
    "무교동",
    "명동",
    "충무로",
    "필동",
    "장교동",
    "인현동",
    "예장동",
    "주교동",
    "입정동",
    "남창동",
    "봉래동",
  ],
  충무로: [
    "충무로",
    "충무로역",
    "필동",
    "인현동",
    "예장동",
    "초동",
    "퇴계로",
    "서울 중구 필동",
    "서울특별시 중구 필동",
    "서울 중구 인현",
    "서울 중구 초동",
    "서울 중구 충무로",
    "서울 중구 예장",
  ],
};

function filterPlacesByCourseAreaFallback(places, areaKey) {
  const phrases = COURSE_AREA_FALLBACK_PHRASES[areaKey];
  if (!phrases?.length || !Array.isArray(places)) return [];
  return places.filter((p) => {
    const blob = placeAreaHaystack(p);
    if (areaKey === "을지로" || areaKey === "동대문" || areaKey === "혜화") {
      if (
        EULJIRO_EXCLUDED_GU_MARKERS.some((g) =>
          blob.includes(String(g).toLowerCase())
        )
      ) {
        return false;
      }
    }
    return phrases.some((s) => blob.includes(String(s).toLowerCase()));
  });
}

/**
 * 코스 엔진·1·2차 재생성 공통: 지역 키워드 매칭 → 주소구문 완화 → 그래도 없으면 area 해제·전체 풀
 */
export function resolveCourseAreaPool(places, parsedQuery) {
  const area = parsedQuery?.area;
  if (!area) {
    return { areaPlaces: places, effectiveParsed: parsedQuery };
  }

  const byKeyword = filterByArea(places, area);
  const byFallback = filterPlacesByCourseAreaFallback(places, area);
  const byProx = filterPlacesByRegionProximity(places, area);

  const seen = new Set();
  const areaPlaces = [];
  for (const p of [...byKeyword, ...byFallback, ...byProx]) {
    if (placeHardExcludedFromArea(p, area)) continue;
    const id = placeId(p);
    const k =
      id != null
        ? String(id)
        : `${p?.lat ?? p?.y ?? ""}_${p?.lng ?? p?.x ?? ""}_${p?.name ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    areaPlaces.push(p);
  }

  // 지역 키워드가 잘못 잡히거나(상호명 등) 풀이 비면 전체로 풀어 2차 후보 0건을 막음.
  // 단, 충무로처럼 역 좌표 고정(distanceFirst) 권역은 절대 전체 풀로 풀지 않음
  // → 비는 순간 을지로·명동 후보가 다시 들어오는 문제 방지
  if (!areaPlaces.length && Array.isArray(places) && places.length) {
    const cfg = COURSE_AREA_CORE[area];
    if (cfg?.distanceFirst || cfg?.requireAllowToken) {
      return { areaPlaces: [], effectiveParsed: parsedQuery };
    }
    const { area: _drop, ...rest } = parsedQuery || {};
    return { areaPlaces: places, effectiveParsed: rest };
  }

  return { areaPlaces, effectiveParsed: parsedQuery };
}

/** 코스 AI·초안 — 지역 키워드·폴백·거리·deny 통합 필터 */
export function filterPlacesForCourseArea(places, areaKey) {
  const area = String(areaKey || "").trim();
  if (!area) return Array.isArray(places) ? places : [];
  return resolveCourseAreaPool(places, { area }).areaPlaces;
}

/** 단일 장소가 코스 `area`에 속하는지 */
export function placeBelongsToCourseArea(place, areaKey) {
  const area = String(areaKey || "").trim();
  if (!area) return true;
  if (placeHardExcludedFromArea(place, area)) return false;
  return filterPlacesForCourseArea([place], area).length > 0;
}

function choosePattern(parsed) {
  if (parsed.includeHalfStep && parsed.steps === 2) {
    const mode = parsed.mode ?? parsed.dateMode;
    if (mode === "date") return COURSE_PATTERNS.date_3step;
    return COURSE_PATTERNS.casual_3step;
  }
  if (parsed.steps !== 2) return null;
  const mode = parsed.mode ?? parsed.dateMode;
  if (mode === "date") return COURSE_PATTERNS.date_2step;
  return COURSE_PATTERNS.casual_2step;
}

function rankByRule(places, rule, parsedQuery, profile) {
  return places
    .map(withResolvedCoords)
    .filter(Boolean)
    .map((place) => ({
      ...place,
      matchScore: calculateCoursePlaceScore(place, rule, parsedQuery, profile),
    }))
    .filter((place) => place.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

function tryBuildCoursesForProfile({
  firstCandidates,
  secondPool,
  rule1,
  rule2,
  distanceLimit,
  parsedQuery,
  profile,
  rng,
}) {
  const results = [];

  for (const first of firstCandidates) {
    const firstClose = getMinutesUntilClose(first);
    if (
      parsedQuery.rightNow &&
      firstClose != null &&
      firstClose < (rule1.stayMinutes ?? 90) * 0.6
    ) {
      continue;
    }

    const secondCandidates = secondPool
      .filter(
        (second) =>
          !isSameVenueForCourseStep(first, second) &&
          haversineMeters(
            Number(first.lat),
            Number(first.lng),
            Number(second.lat),
            Number(second.lng)
          ) >= SECOND_MIN_DISTANCE_METERS &&
          (!parsedQuery.walkable ||
            !courseWalkCrossesHanRiver(
              Number(first.lat),
              Number(first.lng),
              Number(second.lat),
              Number(second.lng)
            ))
      )
      .map((second) => {
        const distance = haversineMeters(
          Number(first.lat),
          Number(first.lng),
          Number(second.lat),
          Number(second.lng)
        );
        const distanceBonus =
          Math.max(0, 30 - distance / 25) * profile.weights.distance;

        const secondClose = getMinutesUntilClose(second);
        let timingBonus = 0;
        if (parsedQuery.rightNow && secondClose != null) {
          if (secondClose >= (rule2.stayMinutes ?? 60)) timingBonus += 10;
          else if (secondClose < 40) timingBonus -= 50;
        }

        return {
          ...second,
          distanceFromFirst: Math.round(distance),
          pairScore:
            first.matchScore +
            second.matchScore +
            distanceBonus +
            timingBonus,
        };
      })
      .filter((second) =>
        Number.isFinite(distanceLimit) && distanceLimit < 1e8
          ? second.distanceFromFirst <= distanceLimit
          : true
      )
      .sort((a, b) => b.pairScore - a.pairScore);

    if (!secondCandidates.length) continue;

    const second = pickFromRankedBand(
      secondCandidates,
      courseBuildPoolSizes(parsedQuery).legPickCap,
      rng
    );
    if (!second) continue;
    const key = `${profile.key}-${placeId(first)}-${placeId(second)}`;

    results.push({
      key,
      profileKey: profile.key,
      profileTitle: profile.title,
      profileDescription: profile.description,
      totalScore: second.pairScore,
      steps: [
        {
          step: 1,
          label: rule1.label,
          stayMinutes: rule1.stayMinutes,
          place: first,
        },
        {
          step: 2,
          label: rule2.label,
          stayMinutes: rule2.stayMinutes,
          walkDistanceMeters: second.distanceFromFirst,
          place: second,
        },
      ],
    });
  }

  return dedupeCoursesByFirstVenue(results);
}

const BRIDGE_LEG_MIN_M = 45;
const BRIDGE_LEG_MAX_M = 1800;

/** 1차 → 쩜오차 → 2차 (쩜오차는 1차 근처, 2차는 쩜오차 기준 거리) */
function tryBuildCoursesForProfileThree({
  firstCandidates,
  bridgePool,
  secondPool,
  rule1,
  ruleBridge,
  rule2,
  distanceLimitSecond,
  parsedQuery,
  profile,
  rng,
}) {
  const results = [];

  for (const first of firstCandidates) {
    const firstClose = getMinutesUntilClose(first);
    if (
      parsedQuery.rightNow &&
      firstClose != null &&
      firstClose < (rule1.stayMinutes ?? 90) * 0.6
    ) {
      continue;
    }

    const bridgeCandidates = bridgePool
      .filter(
        (b) =>
          !isSameVenueForCourseStep(first, b) &&
          haversineMeters(
            Number(first.lat),
            Number(first.lng),
            Number(b.lat),
            Number(b.lng)
          ) >= BRIDGE_LEG_MIN_M &&
          haversineMeters(
            Number(first.lat),
            Number(first.lng),
            Number(b.lat),
            Number(b.lng)
          ) <= BRIDGE_LEG_MAX_M
      )
      .sort((a, b) => b.matchScore - a.matchScore);

    if (!bridgeCandidates.length) continue;

    const bridge = pickFromRankedBand(
      bridgeCandidates,
      courseBuildPoolSizes(parsedQuery).legPickCap,
      rng
    );
    if (!bridge) continue;

    const secondCandidates = secondPool
      .filter(
        (s) =>
          !isSameVenueForCourseStep(first, s) &&
          !isSameVenueForCourseStep(bridge, s) &&
          haversineMeters(
            Number(bridge.lat),
            Number(bridge.lng),
            Number(s.lat),
            Number(s.lng)
          ) >= SECOND_MIN_DISTANCE_METERS &&
          (!parsedQuery.walkable ||
            !courseWalkCrossesHanRiver(
              Number(bridge.lat),
              Number(bridge.lng),
              Number(s.lat),
              Number(s.lng)
            ))
      )
      .map((s) => {
        const distance = haversineMeters(
          Number(bridge.lat),
          Number(bridge.lng),
          Number(s.lat),
          Number(s.lng)
        );
        const distanceBonus =
          Math.max(0, 30 - distance / 25) * profile.weights.distance;

        const secondClose = getMinutesUntilClose(s);
        let timingBonus = 0;
        if (parsedQuery.rightNow && secondClose != null) {
          if (secondClose >= (rule2.stayMinutes ?? 60)) timingBonus += 10;
          else if (secondClose < 40) timingBonus -= 50;
        }

        return {
          ...s,
          distanceFromBridge: Math.round(distance),
          pairScore:
            first.matchScore +
            bridge.matchScore +
            s.matchScore +
            distanceBonus +
            timingBonus,
        };
      })
      .filter((s) =>
        Number.isFinite(distanceLimitSecond) && distanceLimitSecond < 1e8
          ? s.distanceFromBridge <= distanceLimitSecond
          : true
      )
      .sort((a, b) => b.pairScore - a.pairScore);

    if (!secondCandidates.length) continue;

    const second = pickFromRankedBand(
      secondCandidates,
      courseBuildPoolSizes(parsedQuery).legPickCap,
      rng
    );
    if (!second) continue;
    const dFirstBridge = Math.round(
      haversineMeters(
        Number(first.lat),
        Number(first.lng),
        Number(bridge.lat),
        Number(bridge.lng)
      )
    );

    const key = `${profile.key}-${placeId(first)}-${placeId(bridge)}-${placeId(second)}`;

    results.push({
      key,
      profileKey: profile.key,
      profileTitle: profile.title,
      profileDescription: profile.description,
      totalScore: second.pairScore,
      includeHalfStep: true,
      steps: [
        {
          step: 1,
          label: rule1.label,
          stayMinutes: rule1.stayMinutes,
          place: first,
        },
        {
          step: 2,
          label: ruleBridge.label,
          stayMinutes: ruleBridge.stayMinutes,
          walkDistanceMeters: dFirstBridge,
          place: bridge,
        },
        {
          step: 3,
          label: rule2.label,
          stayMinutes: rule2.stayMinutes,
          walkDistanceMeters: second.distanceFromBridge,
          place: second,
        },
      ],
    });
  }

  return dedupeCoursesByFirstVenue(results);
}

function buildCoursesWithProfile({
  parsedQuery,
  places,
  bridgeAugment = [],
  pattern,
  profile,
  rng,
}) {
  const poolSizes = courseBuildPoolSizes(parsedQuery);

  if (Array.isArray(pattern) && pattern.length === 3) {
    const [rule1, ruleBridge, rule2] = pattern;
    const rankedFirst = rankByRule(places, rule1, parsedQuery, profile).slice(
      0,
      poolSizes.rankedFirstCap
    );
    const firstCandidates = shuffleHeadInCopy(
      rankedFirst,
      poolSizes.firstShuffleCap,
      rng
    );
    /** 카페·디저트 카카오 보강은 쩜오차 풀에만 — 2차(rule2) 풀은 DB(및 기존 2차 로직)만 */
    const bridgeSource = mergePlaceListsDedupingVenues(
      places,
      bridgeAugment
    ).filter((p) => !isBudgetChainBridgeCoffeePlace(p));
    let bridgePool = rankByRule(
      bridgeSource,
      ruleBridge,
      parsedQuery,
      profile
    );
    if (!bridgePool.length) {
      bridgePool = bridgeSource
        .map(withResolvedCoords)
        .filter(Boolean)
        .filter((p) => placeLooksLikeBridgeSweetStop(p))
        .map((p) => {
          const s = calculateCoursePlaceScore(
            p,
            ruleBridge,
            parsedQuery,
            profile
          );
          return { ...p, matchScore: Math.max(14, s) };
        })
        .filter((p) => p.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);
    }
    const secondPool = rankByRule(places, rule2, parsedQuery, profile);

    if (!firstCandidates.length || !bridgePool.length || !secondPool.length) {
      return [];
    }

    const walkable = Boolean(parsedQuery.walkable);
    const namedArea = Boolean(parsedQuery?.area);
    const distanceTiers = namedArea
      ? walkable
        ? [450, 800, 1300, 2200, Number.POSITIVE_INFINITY]
        : [1400, 2600, 4000, Number.POSITIVE_INFINITY]
      : walkable
        ? [500, 900, 1400, 2800, Number.POSITIVE_INFINITY]
        : [2000, 8000, Number.POSITIVE_INFINITY];

    for (const limit of distanceTiers) {
      const batch = tryBuildCoursesForProfileThree({
        firstCandidates,
        bridgePool,
        secondPool,
        rule1,
        ruleBridge,
        rule2,
        distanceLimitSecond: limit,
        parsedQuery,
        profile,
        rng,
      });
      if (batch.length) return batch;
    }
    return [];
  }

  const [rule1, rule2] = pattern;
  const rankedFirst = rankByRule(places, rule1, parsedQuery, profile).slice(
    0,
    poolSizes.rankedFirstCap
  );
  const firstCandidates = shuffleHeadInCopy(
    rankedFirst,
    poolSizes.firstShuffleCap,
    rng
  );
  const namedArea = Boolean(parsedQuery?.area);
  const smallNamedPool =
    namedArea && Array.isArray(places) && places.length > 0 && places.length <= 14;

  let secondPool = rankByRule(places, rule2, parsedQuery, profile);
  if (!secondPool.length && smallNamedPool) {
    secondPool = rankByRule(places, rule1, parsedQuery, profile);
  }
  if (!secondPool.length && smallNamedPool) {
    secondPool = places
      .map(withResolvedCoords)
      .filter(Boolean)
      .map((place) => ({
        ...place,
        matchScore: Math.max(
          8,
          Number(place.curatorCount ?? place.curator_count ?? 0) * 2
        ),
      }))
      .filter((place) => place.matchScore > 0);
  }

  if (!firstCandidates.length || !secondPool.length) return [];

  const walkable = Boolean(parsedQuery.walkable);
  /** 지명 코스: 1·2차가 홍대·상수까지 퍼지지 않게 상한을 낮춤. 소규모 동네는 한 단계 더 넓힘 */
  const distanceTiers = namedArea
    ? smallNamedPool
      ? [2500, 5000, 8000, 12000, Number.POSITIVE_INFINITY]
      : walkable
        ? [480, 750, 1200, 2000, Number.POSITIVE_INFINITY]
        : [1500, 2800, 4200, Number.POSITIVE_INFINITY]
    : walkable
      ? [500, 700, 1000, 3000, Number.POSITIVE_INFINITY]
      : [2000, 8000, Number.POSITIVE_INFINITY];

  for (const limit of distanceTiers) {
    const batch = tryBuildCoursesForProfile({
      firstCandidates,
      secondPool,
      rule1,
      rule2,
      distanceLimit: limit,
      parsedQuery,
      profile,
      rng,
    });
    if (batch.length) return batch;
  }

  return [];
}

/**
 * 점수 상위권 안에서 겹치지 않는 코스만 모은 뒤, 그중 무작위 1개
 * (항상 1등만 고르면 같은 식당만 반복되는 문제 완화)
 */
function pickBestDistinctCourse(
  courses,
  usedFirstVenueKeys,
  rng,
  excludeCourseKeys = new Set(),
  excludeVenuePairKeys = new Set()
) {
  const exK =
    excludeCourseKeys instanceof Set
      ? excludeCourseKeys
      : new Set(excludeCourseKeys || []);
  const exP =
    excludeVenuePairKeys instanceof Set
      ? excludeVenuePairKeys
      : new Set(excludeVenuePairKeys || []);
  const usedFirst =
    usedFirstVenueKeys instanceof Set
      ? usedFirstVenueKeys
      : new Set(usedFirstVenueKeys || []);
  const viable = [];
  for (const course of courses) {
    if (course?.key != null && exK.has(course.key)) continue;
    const pair = courseVenuePairKey(course);
    if (pair && exP.has(pair)) continue;
    const fk = firstVenueKeyForCourse(course);
    if (!fk || usedFirst.has(fk)) continue;
    viable.push(course);
  }
  if (!viable.length) return null;

  const byFirst = new Map();
  for (const course of viable) {
    const fk = firstVenueKeyForCourse(course);
    if (!fk) continue;
    if (!byFirst.has(fk)) byFirst.set(fk, []);
    byFirst.get(fk).push(course);
  }
  const groups = shuffleCopyInPlace([...byFirst.values()], rng);
  const group = groups[0];
  if (!group?.length) return null;
  const poolSize = Math.min(8, group.length);
  const pool = shuffleCopyInPlace(group.slice(0, poolSize), rng);
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * 고정된 1·2차 사이에 넣을 쩜오차 1곳 — `tryBuildCoursesForProfileThree`와 동일 거리·점수 감각.
 */
function pickBridgeForFixedEndpoints({
  first,
  second,
  bridgePool,
  rule1,
  rule2,
  effectiveParsed,
  profile,
}) {
  const firstScore = calculateCoursePlaceScore(
    first,
    rule1,
    effectiveParsed,
    profile
  );
  const secondScore = calculateCoursePlaceScore(
    second,
    rule2,
    effectiveParsed,
    profile
  );

  const walkable = Boolean(effectiveParsed.walkable);
  const namedArea = Boolean(effectiveParsed?.area);
  const distanceTiers = namedArea
    ? walkable
      ? [450, 800, 1300, 2200, Number.POSITIVE_INFINITY]
      : [1400, 2600, 4000, Number.POSITIVE_INFINITY]
    : walkable
      ? [500, 900, 1400, 2800, Number.POSITIVE_INFINITY]
      : [2000, 8000, Number.POSITIVE_INFINITY];

  for (const limit of distanceTiers) {
    let best = null;
    let bestScore = -Infinity;
    for (const bridge of bridgePool) {
      if (
        isSameVenueForCourseStep(first, bridge) ||
        isSameVenueForCourseStep(bridge, second)
      ) {
        continue;
      }
      const d1 = haversineMeters(
        Number(first.lat),
        Number(first.lng),
        Number(bridge.lat),
        Number(bridge.lng)
      );
      if (d1 < BRIDGE_LEG_MIN_M || d1 > BRIDGE_LEG_MAX_M) continue;

      const d2 = haversineMeters(
        Number(bridge.lat),
        Number(bridge.lng),
        Number(second.lat),
        Number(second.lng)
      );
      if (d2 < SECOND_MIN_DISTANCE_METERS) continue;
      if (Number.isFinite(limit) && limit < 1e8 && d2 > limit) continue;

      const distanceBonus =
        Math.max(0, 30 - d2 / 25) * profile.weights.distance;
      let timingBonus = 0;
      const secondClose = getMinutesUntilClose(second);
      if (effectiveParsed.rightNow && secondClose != null) {
        if (secondClose >= (rule2.stayMinutes ?? 60)) timingBonus += 10;
        else if (secondClose < 40) timingBonus -= 50;
      }

      const pairScore =
        firstScore +
        bridge.matchScore +
        secondScore +
        distanceBonus +
        timingBonus;

      if (pairScore > bestScore) {
        bestScore = pairScore;
        best = {
          bridge,
          dFirstBridge: Math.round(d1),
          dBridgeSecond: Math.round(d2),
          pairScore,
        };
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * UI 쩜오 ON: 화면에 있던 2단 추천 코스의 1·2차는 유지하고 쩜오차만 끼움 (실패 시 해당 카드는 2단 유지).
 */
export function upgradeTwoStepCoursesToHalfStep({
  parsedQuery,
  places = [],
  bridgeAugment = [],
  existingCourses = [],
}) {
  const pattern = choosePattern(parsedQuery);
  if (!pattern || pattern.length !== 3) {
    return Array.isArray(existingCourses) ? [...existingCourses] : [];
  }

  const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(
    places,
    parsedQuery
  );
  if (!areaPlaces.length) {
    return Array.isArray(existingCourses) ? [...existingCourses] : [];
  }

  const areaKey = effectiveParsed?.area;
  const areaBridgeAugment = areaKey
    ? (bridgeAugment || []).filter((p) => placeMatchesArea(p, areaKey))
    : bridgeAugment || [];

  const [rule1, ruleBridge, rule2] = pattern;
  const out = [];

  for (const course of existingCourses) {
    const steps = course?.steps || [];
    if (steps.length >= 3) {
      out.push(course);
      continue;
    }
    if (steps.length < 2) {
      out.push(course);
      continue;
    }

    const profile = COURSE_PROFILES[course.profileKey] || COURSE_PROFILES.normal;
    const firstPlace = steps[0]?.place;
    const secondPlace = steps[1]?.place;
    const first = withResolvedCoords(firstPlace);
    const second = withResolvedCoords(secondPlace);
    if (!first || !second) {
      out.push(course);
      continue;
    }

    const bridgeSource = mergePlaceListsDedupingVenues(
      areaPlaces,
      areaBridgeAugment
    ).filter((p) => !isBudgetChainBridgeCoffeePlace(p));
    let bridgePool = rankByRule(
      bridgeSource,
      ruleBridge,
      effectiveParsed,
      profile
    );
    if (!bridgePool.length) {
      bridgePool = bridgeSource
        .map(withResolvedCoords)
        .filter(Boolean)
        .filter((p) => placeLooksLikeBridgeSweetStop(p))
        .map((p) => {
          const s = calculateCoursePlaceScore(
            p,
            ruleBridge,
            effectiveParsed,
            profile
          );
          return { ...p, matchScore: Math.max(14, s) };
        })
        .filter((p) => p.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);
    }

    const best = pickBridgeForFixedEndpoints({
      first,
      second,
      bridgePool,
      rule1,
      rule2,
      effectiveParsed,
      profile,
    });

    if (!best) {
      out.push(course);
      continue;
    }

    const { bridge, dFirstBridge, dBridgeSecond, pairScore } = best;

    out.push({
      ...course,
      key: `${course.key}-half-${placeId(bridge) ?? "b"}`,
      includeHalfStep: true,
      totalScore: pairScore,
      steps: [
        {
          ...steps[0],
          step: 1,
          label: rule1.label,
          stayMinutes: rule1.stayMinutes,
          place: firstPlace,
        },
        {
          step: 2,
          label: ruleBridge.label,
          stayMinutes: ruleBridge.stayMinutes,
          walkDistanceMeters: dFirstBridge,
          place: bridge,
        },
        {
          ...steps[1],
          step: 3,
          label: rule2.label,
          stayMinutes: rule2.stayMinutes,
          walkDistanceMeters: dBridgeSecond,
          place: secondPlace,
        },
      ],
    });
  }

  return out;
}

/**
 * UI 쩜오 OFF: 3단 코스에서 가운데 쩜오차만 제거하고 1차와 마지막(2차)만 남김.
 */
export function stripHalfStepFromCourses(courses = []) {
  return courses.map((course) => {
    const steps = course?.steps || [];
    if (steps.length < 3) {
      const { includeHalfStep: _ih, ...rest } = course;
      return { ...rest, includeHalfStep: false };
    }
    const s0 = steps[0];
    const sLast = steps[steps.length - 1];
    const p0 = s0?.place;
    const p2 = sLast?.place;
    const w0 = resolvePlaceWgs84(p0);
    const w2 = resolvePlaceWgs84(p2);
    if (!w0 || !w2) return course;
    const d = haversineMeters(w0.lat, w0.lng, w2.lat, w2.lng);
    const id0 = placeId(p0);
    const id2 = placeId(p2);
    return {
      ...course,
      key: `${course.profileKey || "c"}-${id0 ?? "a"}-${id2 ?? "z"}-2leg`,
      includeHalfStep: false,
      steps: [
        {
          ...s0,
          step: 1,
          label: s0.label || "1차",
          place: p0,
        },
        {
          ...sLast,
          step: 2,
          label: sLast.label || "2차",
          walkDistanceMeters: Number.isFinite(d) ? Math.round(d) : sLast.walkDistanceMeters,
          place: p2,
        },
      ],
    };
  });
}

/**
 * 프로필별 성격 다른 코스 최대 3개 (정석·분위기·큐레이터 픽).
 * @param {number} [opts.maxOptions] 1이면 정석 프로필만 1개 (하위 호환)
 * @param {Iterable<string>} [opts.excludeCourseKeys] 이미 본 `course.key` 제외
 * @param {Iterable<string>} [opts.excludeVenuePairKeys] 이미 본 1차·2차 id 조합 제외
 */
export function generateCourseOptions({
  parsedQuery,
  places = [],
  /** 쩜오차 전용(카카오 등) — `places`에 섞지 말 것. 2차 후보 오염 방지 */
  bridgeAugment = [],
  maxOptions = 3,
  excludeCourseKeys = [],
  excludeVenuePairKeys = [],
}) {
  const pattern = choosePattern(parsedQuery);
  if (!pattern || !Array.isArray(pattern) || pattern.length < 2) return [];

  const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(
    places,
    parsedQuery
  );

  if (!areaPlaces.length) return [];

  const areaKey = effectiveParsed?.area;
  const areaBridgeAugment = areaKey
    ? (bridgeAugment || []).filter((p) => placeMatchesArea(p, areaKey))
    : bridgeAugment || [];

  const profiles =
    maxOptions === 1 ? [COURSE_PROFILES.normal] : COURSE_PROFILE_ORDER;

  const invocationSeed =
    (hashString(String(effectiveParsed?.raw || "")) ^ Date.now()) >>> 0;

  const selectedCourses = [];
  const usedFirstVenueKeys = new Set();
  const seenCourseKeys = new Set();
  const seenPairKeys = new Set();
  const excludeKeySet =
    excludeCourseKeys instanceof Set
      ? excludeCourseKeys
      : new Set(excludeCourseKeys || []);
  const excludePairSet =
    excludeVenuePairKeys instanceof Set
      ? excludeVenuePairKeys
      : new Set(excludeVenuePairKeys || []);

  for (const profile of profiles) {
    if (selectedCourses.length >= maxOptions) break;

    const rng = mulberry32(
      (invocationSeed + hashString(profile.key || "")) >>> 0
    );

    const candidates = buildCoursesWithProfile({
      parsedQuery: effectiveParsed,
      places: areaPlaces,
      bridgeAugment: areaBridgeAugment,
      pattern,
      profile,
      rng,
    });

    if (!candidates.length) continue;

    const picked = pickBestDistinctCourse(
      candidates,
      usedFirstVenueKeys,
      rng,
      excludeKeySet,
      excludePairSet
    );
    if (!picked) continue;

    selectedCourses.push(picked);
    if (picked?.key != null) seenCourseKeys.add(String(picked.key));
    {
      const pair = courseVenuePairKey(picked);
      if (pair) seenPairKeys.add(pair);
    }
    const fk = firstVenueKeyForCourse(picked);
    if (fk) usedFirstVenueKeys.add(fk);
  }

  /**
   * 프로필 간 venue 완전 비중복을 강제하면 지역/카테고리 풀이 작은 쿼리(예: 「연남동 2차 코스」)에서
   * 카드가 1개만 남는 경우가 있다. 이때는 pair/key 중복만 막고 나머지 슬롯을 보강한다.
   */
  if (selectedCourses.length < maxOptions) {
    const fallbackReservoir = [];
    const fallbackAllowPairDup = [];
    for (const profile of profiles) {
      const rng = mulberry32(
        (invocationSeed + hashString(`${profile.key || ""}:fallback`)) >>> 0
      );
      const candidates = buildCoursesWithProfile({
        parsedQuery: effectiveParsed,
        places: areaPlaces,
        bridgeAugment: areaBridgeAugment,
        pattern,
        profile,
        rng,
      });
      for (const c of candidates) {
        const ckey = c?.key != null ? String(c.key) : null;
        if (ckey && (excludeKeySet.has(ckey) || seenCourseKeys.has(ckey))) continue;
        const pair = courseVenuePairKey(c);
        if (pair && (excludePairSet.has(pair) || seenPairKeys.has(pair))) {
          fallbackAllowPairDup.push(c);
          continue;
        }
        fallbackReservoir.push(c);
      }
    }
    const shuffledFallback = shuffleCopyInPlace(fallbackReservoir, mulberry32(
      (invocationSeed ^ 0x9e3779b9) >>> 0
    ));
    for (const c of shuffledFallback) {
      if (selectedCourses.length >= maxOptions) break;
      const fk = firstVenueKeyForCourse(c);
      if (fk && usedFirstVenueKeys.has(fk)) continue;
      selectedCourses.push(c);
      if (c?.key != null) seenCourseKeys.add(String(c.key));
      const pair = courseVenuePairKey(c);
      if (pair) seenPairKeys.add(pair);
      if (fk) usedFirstVenueKeys.add(fk);
    }
    /** 지역·태그 풀이 매우 작을 때: pair 중복 허용(동일 코스 key는 제외)으로 3카드 채우기 */
    for (const c of fallbackAllowPairDup) {
      if (selectedCourses.length >= maxOptions) break;
      const ckey = c?.key != null ? String(c.key) : null;
      if (ckey && (excludeKeySet.has(ckey) || seenCourseKeys.has(ckey))) continue;
      selectedCourses.push(c);
      if (ckey) seenCourseKeys.add(ckey);
    }
  }

  return selectedCourses;
}

/**
 * LLM 리랭크용 후보 풀 — UI 3카드와 별도로 프로필별 buildCoursesWithProfile 상위 후보를 모음.
 *
 * @param {object} opts — generateCourseOptions와 동일 축 (maxOptions 제외)
 * @param {number} [opts.limit=12]
 */
export function generateCourseCandidatePool({
  parsedQuery,
  places = [],
  bridgeAugment = [],
  limit = 12,
  excludeCourseKeys = [],
  excludeVenuePairKeys = [],
}) {
  const pattern = choosePattern(parsedQuery);
  if (!pattern || !Array.isArray(pattern) || pattern.length < 2) return [];

  const { areaPlaces, effectiveParsed } = resolveCourseAreaPool(
    places,
    parsedQuery
  );
  if (!areaPlaces.length) return [];

  const areaKey = effectiveParsed?.area;
  const areaBridgeAugment = areaKey
    ? (bridgeAugment || []).filter((p) => placeMatchesArea(p, areaKey))
    : bridgeAugment || [];

  const invocationSeed =
    (hashString(String(effectiveParsed?.raw || "")) ^ Date.now()) >>> 0;
  const excludeKeySet = new Set(
    excludeCourseKeys instanceof Set
      ? excludeCourseKeys
      : excludeCourseKeys || []
  );

  const merged = [];
  const seenKeys = new Set();

  for (const profile of COURSE_PROFILE_ORDER) {
    const rng = mulberry32(
      (invocationSeed + hashString(profile.key || "")) >>> 0
    );
    const candidates = buildCoursesWithProfile({
      parsedQuery: effectiveParsed,
      places: areaPlaces,
      bridgeAugment: areaBridgeAugment,
      pattern,
      profile,
      rng,
    });
    const dedupedProfile = dedupeCoursesByFirstVenue(candidates);
    for (const c of dedupedProfile.slice(0, 8)) {
      const k = c?.key != null ? String(c.key) : "";
      if (!k || excludeKeySet.has(k) || seenKeys.has(k)) continue;
      seenKeys.add(k);
      merged.push(c);
    }
  }

  merged.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  const cap =
    typeof limit === "number" && limit > 0 ? Math.floor(limit) : 12;
  return merged.slice(0, cap);
}

/** 3단 코스 가운데 쩜오차 스텝 — 라벨 오타·누락에도 🍦 마커 판별 */
export function isCourseBridgeStep(step, stepCount = 0) {
  const label = String(step?.label || "").trim();
  if (/쩜오/.test(label)) return true;
  const stepNum = Number(step?.step) || 1;
  return stepCount >= 3 && stepNum === 2;
}

/** 코스 결과 전체 → 지도 마커(중복 id 제거). 선택 코스만 쓰려면 인자로 1요소 배열 전달 */
export function resolveCourseStepMapCaption(step, stepCount = 0) {
  if (isCourseBridgeStep(step, stepCount)) return "쩜오차";
  if (typeof step?.label === "string" && step.label.trim()) {
    return step.label.trim();
  }
  const stepNum = Number(step?.step) || 1;
  if (stepNum === 1) return "1차";
  return "2차";
}

/**
 * 조합 미리보기 vs 선택 코스 — 2칸 compose가 3단 selectedCourse(쩜오 포함)를 가리지 않게.
 */
export function resolveCourseDrivingMap(composePreview, selectedCourse) {
  if (!composePreview?.steps?.length) return selectedCourse ?? null;
  if (!selectedCourse?.steps?.length) return composePreview;

  const previewSteps = composePreview.steps;
  const selectedSteps = selectedCourse.steps;
  const previewHasBridge = previewSteps.some((s) =>
    isCourseBridgeStep(s, previewSteps.length),
  );
  const selectedHasBridge = selectedSteps.some((s) =>
    isCourseBridgeStep(s, selectedSteps.length),
  );

  if (selectedHasBridge && !previewHasBridge && previewSteps.length <= 2) {
    return selectedCourse;
  }
  if (previewSteps.length > selectedSteps.length) return composePreview;
  if (previewHasBridge) return composePreview;
  return composePreview;
}

export function courseOptionsToMapPlaces(options = []) {
  const out = [];
  const seen = new Set();
  for (const course of options) {
    const stepCount = course?.steps?.length ?? 0;
    for (const step of course?.steps || []) {
      const p = step.place;
      if (!p) continue;
      const w = resolvePlaceWgs84(p);
      if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
      const id = placeId(p);
      const stepNum = Number(step.step) || 1;
      const sid =
        id != null ? `${String(id)}-s${stepNum}` : `course_${out.length}`;
      if (seen.has(sid)) continue;
      seen.add(sid);
      const lat = w.lat;
      const lng = w.lng;
      const mapCaption = resolveCourseStepMapCaption(step, stepCount);
      out.push({
        ...p,
        id: sid,
        name: p.name || p.place_name,
        place_name: p.place_name || p.name,
        lat,
        lng,
        y: String(lat),
        x: String(lng),
        category_name: p.category_name || "",
        address_name: p.address_name || "",
        isCoursePin: true,
        courseMapCaption: mapCaption,
        courseStepIndex: stepNum,
        courseLegCount: stepCount,
        courseStepThumbUrl:
          p.courseStepThumbUrl ||
          p.step_image_url ||
          p.image_url ||
          null,
      });
    }
  }
  return out;
}

function pulseMapPlaceThumbUrl(place) {
  if (!place || typeof place !== "object") return null;
  return (
    place.courseStepThumbUrl ||
    place.step_image_url ||
    place.image_url ||
    place.image ||
    place.thumbnail_url ||
    null
  );
}

/**
 * 2차 재추천 결과(코스 배열) → 지도: 1차 고정 + 2차 후보마다 깜빡임(MapView courseMarkerPulse)
 */
export function courseSecondCandidatesToPulseMapPlaces(courses = []) {
  if (!Array.isArray(courses) || courses.length === 0) return [];
  const out = [];
  const firstPlace = courses[0]?.steps?.[0]?.place;
  if (firstPlace) {
    const w = resolvePlaceWgs84(firstPlace);
    if (w && Number.isFinite(w.lat) && Number.isFinite(w.lng)) {
      const id = placeId(firstPlace);
      const sid = id != null ? String(id) : "course_1st";
      out.push({
        ...firstPlace,
        id: sid,
        name: firstPlace.name || firstPlace.place_name,
        place_name: firstPlace.place_name || firstPlace.name,
        lat: w.lat,
        lng: w.lng,
        y: String(w.lat),
        x: String(w.lng),
        category_name: firstPlace.category_name || "",
        address_name: firstPlace.address_name || "",
        isCoursePin: true,
        courseMapCaption: "1차",
        courseStepIndex: 1,
        courseMarkerPulse: false,
        courseStepThumbUrl: pulseMapPlaceThumbUrl(firstPlace),
      });
    }
  }
  const refSteps = courses[0]?.steps || [];
  if (refSteps.length >= 3) {
    const bp = refSteps[1]?.place;
    const wb = resolvePlaceWgs84(bp);
    if (wb && Number.isFinite(wb.lat) && Number.isFinite(wb.lng)) {
      const bid = placeId(bp);
      const bkey = bid != null ? String(bid) : "course_bridge";
      const firstKey = firstPlace ? String(placeId(firstPlace) ?? "course_1st") : "";
      if (!firstKey || bkey !== firstKey) {
        out.push({
          ...bp,
          id: bkey,
          name: bp.name || bp.place_name,
          place_name: bp.place_name || bp.name,
          lat: wb.lat,
          lng: wb.lng,
          y: String(wb.lat),
          x: String(wb.lng),
          category_name: bp.category_name || "",
          address_name: bp.address_name || "",
          isCoursePin: true,
          courseMapCaption: "쩜오차",
          courseStepIndex: 2,
          courseLegCount: 3,
          courseMarkerPulse: false,
          courseStepThumbUrl: pulseMapPlaceThumbUrl(bp),
        });
      }
    }
  }
  const seenSecond = new Set();
  for (let i = 0; i < courses.length; i++) {
    const steps = courses[i]?.steps || [];
    const p = steps.length >= 2 ? steps[steps.length - 1]?.place : null;
    if (!p) continue;
    const w = resolvePlaceWgs84(p);
    if (!w || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) continue;
    const id = placeId(p);
    const key =
      id != null ? String(id) : `course_2_${i}_${String(p.name || "").slice(0, 24)}`;
    if (seenSecond.has(key)) continue;
    seenSecond.add(key);
    const lastStep = steps[steps.length - 1];
    const cap =
      typeof lastStep?.label === "string" && lastStep.label.trim()
        ? lastStep.label.trim()
        : "2차";
    out.push({
      ...p,
      id: key,
      name: p.name || p.place_name,
      place_name: p.place_name || p.name,
      lat: w.lat,
      lng: w.lng,
      y: String(w.lat),
      x: String(w.lng),
      category_name: p.category_name || "",
      address_name: p.address_name || "",
      isCoursePin: true,
      courseMapCaption: cap,
      courseStepIndex: Number(lastStep?.step) || 2,
      courseMarkerPulse: true,
      courseStepThumbUrl: pulseMapPlaceThumbUrl(p),
      liquorSteerRequested: Boolean(courses[i]?.liquorSteerRequested),
      liquorCategoryMatched: Boolean(
        p.liquorCategoryMatched ?? courses[i]?.liquorCategoryMatched
      ),
    });
  }
  return out;
}
