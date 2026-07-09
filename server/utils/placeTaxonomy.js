/**
 * Server copy of src/utils/placeTaxonomy.js (Railway root = server/).
 * Keep in sync with the frontend canonical file when taxonomy changes.
 */

/** Studio 잔 올리기 「술종류」 셀렉트와 동일 순서·표기 */
export const STUDIO_LIQUOR_TYPE_OPTIONS = [
  "소주",
  "맥주",
  "막걸리",
  "전통주",
  "하이볼",
  "위스키",
  "고량주",
  "사케",
  "와인",
  "칵테일",
];

/**
 * Studio 잔 올리기 · 2차 찾기 공통 분위기 축.
 * 활기찬 = 활기찬+시끄러운 / 모던함 = 세련된+모던한 / 힙한 = 별도
 */
export const STUDIO_ATMOSPHERE_OPTIONS = [
  "활기찬",
  "모던함",
  "조용한",
  "편안한",
  "힙한",
];

/** Studio 잔 올리기 「업종」— 아카이브·집계와 동일 순서 (지도 원문 → `normalizeStudioPlaceCategory`) */
export const STUDIO_PLACE_CATEGORY_OPTIONS = [
  "한식",
  "중식",
  "일식",
  "양식",
  "육류",
  "해산물",
  "디저트",
  "술집·바",
  "미분류",
];

/**
 * 카카오 `category_name` 등 임의 문자열 → 잔 올리기 표준 업종.
 * DB `places.category`·아카이브 RPC와 규칙을 맞출 것 (SQL `studio_normalize_place_category`).
 */
export function normalizeStudioPlaceCategory(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "미분류";
  if (STUDIO_PLACE_CATEGORY_OPTIONS.includes(s)) return s;

  const u = s.toLowerCase();

  if (/(중식|짜장|짬뽕)/i.test(u)) return "중식";
  if (/(일식|돈까스|돈가스|라멘|라면|우동|일본|오마카세|스시|초밥)/i.test(u))
    return "일식";
  if (
    /(양식|파스타|피자|스테이크|프렌치|이탈리아|브런치|버거)/i.test(u)
  )
    return "양식";
  if (
    /(해산물|횟집|회집|생선회|생선|조개|새우|사시미|참치|해물|오징어|게장|물회|수산|회전)/i.test(
      u
    )
  )
    return "해산물";
  if (
    /(디저트|카페|베이커리|케이크|빵|커피|아이스크림|도넛)/i.test(u)
  )
    return "디저트";
  if (
    /(술집|와인바|와인|이자카야|호프|주점|펍|포장마차|포차|루프탑|야장|칵테일|클럽|라운지|노포|실내포장|야외포장|테라스|요리주점|맥주|소주)/i.test(
      u
    )
  )
    return "술집·바";
  if (
    /(돼지|소고기|고기|구이|삼겹|갈비|육류|닭|치킨|족발|보쌈|곱창|막창|스테이크)/i.test(
      u
    )
  )
    return "육류";
  if (
    /(한식|국밥|탕|찌개|순대|감자탕|설렁탕|해장|국수|냉면|비빔밥|순두부|곰탕|백반|죽|한우|밥집)/i.test(
      u
    )
  )
    return "한식";
  if (/(슈퍼|마트|편의점|이마트)/i.test(u)) return "미분류";
  if (/순대|순댓/i.test(s)) return "한식";

  return "미분류";
}

/** 2차 찾기 안주 칩 (국물은 해장·국물류와 연결) */
export const COURSE_SECOND_SNACK_OPTIONS = [
  "국물",
  "해산물/회",
  "육류",
  "플래터",
  "튀김",
];

/** 2차 찾기 분위기 칩 — 잔 올리기와 동일 */
export const COURSE_SECOND_VIBE_OPTIONS = STUDIO_ATMOSPHERE_OPTIONS;

/** 레거시·세분 분위기 → 공통 축 (잔 올리기 셀렉트·2차 칩) */
export function mapStudioVibeToSecondFindBucket(vibe) {
  const v = String(vibe ?? "").trim();
  if (!v) return null;
  if (STUDIO_ATMOSPHERE_OPTIONS.includes(v)) return v;
  if (/활기|시끄|시끌|북적|우당탕|소란/i.test(v)) return "활기찬";
  if (/힙/i.test(v)) return "힙한";
  if (/세련|모던/i.test(v)) return "모던함";
  if (/조용|잔잔|차분/i.test(v)) return "조용한";
  if (/편안|편한|부담없|아늑/i.test(v)) return "편안한";
  return null;
}

/** DB·폼에 남은 옛 분위기 문자열 → 표준 옵션 (없으면 "") */
export function normalizeStudioAtmosphere(raw) {
  return mapStudioVibeToSecondFindBucket(raw) || "";
}

/** @param {string[]} vibes */
export function mapStudioVibesToSecondFindDefaults(vibes) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(vibes) ? vibes : []) {
    const b = mapStudioVibeToSecondFindBucket(raw);
    if (!b || seen.has(b)) continue;
    seen.add(b);
    out.push(b);
    if (out.length >= 2) break;
  }
  return out;
}

/** Studio·2차 찾기 분위기 선택 → places.vibes·태그 등과 맞추기 위한 별칭 */
const VIBE_PREF_ALIASES = {
  활기찬: [
    "활기찬",
    "활기",
    "시끌벅적",
    "시끌",
    "북적",
    "시끄러운",
    "시끄",
    "우당탕",
    "소란",
  ],
  시끄러운: ["시끄러운", "시끄", "시끌", "우당탕", "소란", "활기찬", "북적"],
  모던함: ["모던함", "모던한", "모던", "세련된", "세련"],
  세련된: ["세련된", "세련", "모던", "모던한", "모던함"],
  모던한: ["모던한", "모던", "모던함", "세련된", "세련"],
  힙한: ["힙한", "힙", "힙플", "힙플레이스", "트렌디", "핫플"],
  조용한: ["조용한", "조용", "잔잔", "차분"],
  편안한: ["편안한", "편한", "부담없", "아늑"],
  로맨틱한: ["로맨틱한", "로맨틱", "데이트", "분위기좋은"],
  아기자기한: ["아기자기", "아담"],
  빈티지: ["빈티지", "올드", "레트로"],
  전통적인: ["전통", "전통적인", "노포", "옛날"],
};

/**
 * @param {string} pref 사용자가 고른 분위기(Studio 표준 한 가지)
 * @returns {string[]} 소문자 토큰 — place.vibes·atmosphere·태그와 부분 매칭
 */
export function expandVibePrefTokens(pref) {
  const p = String(pref ?? "").trim().toLowerCase();
  if (!p) return [];
  for (const k of Object.keys(VIBE_PREF_ALIASES)) {
    if (k.toLowerCase() === p) {
      return VIBE_PREF_ALIASES[k].map((x) => String(x).toLowerCase());
    }
  }
  return [p];
}

/**
 * @param {string} hint 안주 칩 (국물 = 해장·국물류, 튀김 = 태그·카테고리 매칭 확장)
 */
export function expandAnjuHintTokens(hint) {
  const h = String(hint ?? "").trim().toLowerCase();
  if (!h) return [];
  if (h === "국물") {
    return [
      "국물",
      "해장",
      "찌개",
      "국밥",
      "전골",
      "육개장",
      "순대국",
      "설렁탕",
      "감자탕",
      "뼈해장",
      "곰탕",
      "추어탕",
      "해장국",
      "복어",
      "복국",
      "복매운탕",
      "매운탕",
      "부대찌개",
      "샤브",
      "도가니탕",
      "갈비탕",
      "삼계탕",
      "해물탕",
      "알탕",
      "대구탕",
      "꼬리탕",
      "국물안주",
    ];
  }
  if (h === "튀김") {
    return [
      "튀김",
      "튀김류",
      "모둠튀김",
      "튀김안주",
      "통튀김",
      "새우튀김",
      "치킨",
      "닭강정",
      "튀김요리",
    ];
  }
  if (h === "해산물" || h === "해산물/회") {
    return [
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
      "해산",
      "사시미",
      "오마카세",
      "스시",
      "초밥",
      "활어",
      "수산",
      "회",
    ];
  }
  if (h === "육류") {
    return ["육류", "고기", "삼겹살", "갈비", "고깃집", "스테이크"];
  }
  // 레거시 «치즈» 칩도 동일 확장
  if (h === "플래터" || h === "치즈") {
    return [
      "플래터",
      "치즈플래터",
      "치즈",
      "샤퀴테리",
      "샤퀴",
      "타파스",
      "과일안주",
      "모둠안주",
      "안주다양",
      "와인바",
      "치즈볼",
      "맥앤치즈",
    ];
  }
  return [h];
}

/**
 * 2차 안주 가산점: `expandAnjuHintTokens`의 짧은 토큰(특히 «회»)이 상호·태그에서 오탐하지 않게.
 * @param {string} hayLower placeAnjuHaystack 한 조각(이미 소문자화했다고 가정)
 * @param {string} tok expand 토큰(소문자)
 */
export function anjuExpandedTokenMatchesHaystack(hayLower, tok) {
  const t = String(hayLower ?? "").toLowerCase();
  const k = String(tok ?? "").toLowerCase();
  if (!t || !k) return false;
  if (k !== "회") {
    // 짧은 hay(예: «식»)가 긴 토큰(«해산물»)에 포함돼 오탐하지 않게
    if (t.length <= 1) return false;
    if (t.includes(k) || t === k) return true;
    // 토큰⊃hay: hay가 토큰의 의미 있는 부분일 때만 (분식·식 ↔ 해산물 오탐 방지)
    if (t.length >= 3 && k.includes(t)) return true;
    return false;
  }
  if (/회식|회의|회원|학회|사회|대회|총회|주주|이사회|위원회|동호회/.test(t)) {
    return false;
  }
  if (
    /(생선|모둠|물|참치|연어|광어|우럭|방어|도미|참돔|전복|활어|꽁치|키조개)회|횟집|회집|회덮밥|회\s*전문|회전초밥|사시미|오마카세|수산시장|해물탕|해물찜/.test(
      t
    )
  ) {
    return true;
  }
  if (t === "회") return true;
  return false;
}

function placeAnjuSignalHay(place) {
  return [
    place?.name,
    place?.place_name,
    place?.category,
    place?.category_name,
    ...(Array.isArray(place?.categories) ? place.categories : []),
    ...(Array.isArray(place?.tags) ? place.tags : []),
  ]
    .map((s) => String(s || "").toLowerCase())
    .join(" ");
}

/** 분식·김밥·떡볶이 계열 — 해산물/회·국물 안주와 충돌 */
export function placeLooksLikeBunsik(place) {
  const hay = placeAnjuSignalHay(place);
  if (!hay.trim()) return false;
  return /분식|떡볶|김밥|라면\s*집|쫄면|만두\s*전문|어묵\s*전문|핫도그|토스트\s*전문/.test(
    hay
  );
}

/** 해산물/회 안주와 맞는 신호 */
export function placeLooksLikeSeafoodAnju(place) {
  const hay = placeAnjuSignalHay(place);
  if (!hay.trim()) return false;
  return /해산물|해물|횟집|회집|생선회|모둠회|물회|회덮밥|사시미|오마카세|스시|초밥|활어|수산|조개|낙지|문어|게장|회\s*전문|회전초밥/.test(
    hay
  );
}

/** 국물 안주 — 탕·국밥·복어·전골·찌개 한식 (분식·라면집 제외는 호출측) */
export function placeLooksLikeGukmulAnju(place) {
  const hay = placeAnjuSignalHay(place);
  if (!hay.trim()) return false;
  if (placeLooksLikeBunsik(place)) return false;
  return /국물|국밥|해장|찌개|전골|육개장|순대국|설렁탕|감자탕|뼈해장|곰탕|추어탕|해장국|복어|복국|복매운탕|매운탕|부대찌개|샤브|도가니|갈비탕|삼계탕|해물탕|알탕|대구탕|꼬리탕|국물안주|탕\s*전문|전골\s*전문|국밥\s*전문|복어\s*전문/.test(
    hay
  );
}

/** 큐레이터 잔 올리기·검색 가중치와 맞춘 추천 태그(일부는 Studio 칩에도 동일 표기) */
export const STUDIO_CURATOR_SITUATION_TAGS = ["낮술", "혼술", "야장", "2차"];

export function taxonomyContextBlockForMl() {
  return [
    "JUDO_TAX",
    "liquor:" + STUDIO_LIQUOR_TYPE_OPTIONS.join("|"),
    "vibe:" + STUDIO_ATMOSPHERE_OPTIONS.join("|"),
    "food_cat:" + STUDIO_PLACE_CATEGORY_OPTIONS.join("|"),
    "snack:" + COURSE_SECOND_SNACK_OPTIONS.join("|"),
    "situation:" + STUDIO_CURATOR_SITUATION_TAGS.join("|"),
  ].join(" ");
}
