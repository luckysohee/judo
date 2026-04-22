/**
 * 잔 올리기(Studio)·2차 찾기 모달·코스 룰·검색 의도(ML)·임베딩 문맥 공통 표준값.
 * 한곳에서만 수정하고 각 화면/서버가 import 해 쓴다.
 */

/** Studio 잔 올리기 「술종류」 셀렉트와 동일 순서·표기 */
export const STUDIO_LIQUOR_TYPE_OPTIONS = [
  "소주",
  "맥주",
  "막걸리",
  "하이볼",
  "위스키",
  "고량주",
  "사케",
  "와인",
  "칵테일",
];

/** Studio 잔 올리기 「분위기」 셀렉트와 동일 */
export const STUDIO_ATMOSPHERE_OPTIONS = [
  "조용한",
  "활기찬",
  "시끄러운",
  "아기자기한",
  "세련된",
  "편안한",
  "로맨틱한",
  "빈티지",
  "모던한",
  "전통적인",
];

/** 2차 찾기 안주 칩 (국물은 해장·국물류와 연결) */
export const COURSE_SECOND_SNACK_OPTIONS = [
  "국물",
  "해산물/회",
  "육류",
  "치즈",
  "튀김",
  "마른안주",
];

/** Studio 분위기 선택 → places.vibes·태그 등과 맞추기 위한 별칭 */
const VIBE_PREF_ALIASES = {
  활기찬: ["활기찬", "시끌벅적", "시끌", "북적", "활기"],
  시끄러운: ["시끄러운", "시끄", "시끌", "우당탕", "소란"],
  조용한: ["조용한", "조용", "잔잔", "차분"],
  편안한: ["편안한", "편한", "부담없"],
  로맨틱한: ["로맨틱한", "로맨틱", "데이트", "분위기좋은"],
  세련된: ["세련된", "세련", "모던", "힙"],
  모던한: ["모던한", "모던"],
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
 * @param {string} hint 안주 칩 (국물 = 해장·국물류, 튀김·마른안주 = 태그·카테고리 매칭 확장)
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
      "탕",
      "전골",
      "라면",
      "육개장",
      "순대",
      "설렁탕",
      "감자탕",
      "뼈해장",
      "곰탕",
      "추어탕",
      "해장국",
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
  if (h === "마른안주" || h === "마른 안주") {
    return [
      "마른안주",
      "마른 안주",
      "말린",
      "건어물",
      "육포",
      "말린오징어",
      "오징어",
      "쥐포",
      "버터칩",
      "견과",
      "견과류",
      "땅콩",
      "과자",
      "스낵",
      "안주",
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
      /** 단독 «회»는 `anjuExpandedTokenMatchesHaystack`에서 회식 등 제외 후 매칭 */
      "회",
    ];
  }
  if (h === "육류") {
    return ["육류", "고기", "삼겹살", "갈비", "고깃집", "스테이크"];
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
    return t.includes(k) || k.includes(t) || t === k;
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

/** 임베딩·의도 파서가 같은 어휘 집합을 보도록 짧은 문맥 블록 */
/** 큐레이터 잔 올리기·검색 가중치와 맞춘 추천 태그(일부는 Studio 칩에도 동일 표기) */
export const STUDIO_CURATOR_SITUATION_TAGS = ["낮술", "혼술", "야장", "2차"];

export function taxonomyContextBlockForMl() {
  return [
    "JUDO_TAX",
    "liquor:" + STUDIO_LIQUOR_TYPE_OPTIONS.join("|"),
    "vibe:" + STUDIO_ATMOSPHERE_OPTIONS.join("|"),
    "snack:" + COURSE_SECOND_SNACK_OPTIONS.join("|"),
    "situation:" + STUDIO_CURATOR_SITUATION_TAGS.join("|"),
  ].join(" ");
}
