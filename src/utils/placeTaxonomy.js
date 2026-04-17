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
  "해산물",
  "육류",
  "치즈",
  "튀김",
  "마른안주",
];

/** Studio 분위기 선택 → places.vibes·태그 등과 맞추기 위한 별칭 */
const VIBE_PREF_ALIASES = {
  활기찬: ["활기찬", "시끌벅적", "시끌", "북적", "활기"],
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
  if (h === "해산물") {
    return [
      "해산물",
      "횟집",
      "생선회",
      "해물",
      "조개",
      "새우",
      "낙지",
      "문어",
      "게장",
      "회집",
      "해산",
    ];
  }
  if (h === "육류") {
    return ["육류", "고기", "삼겹살", "갈비", "고깃집", "스테이크"];
  }
  return [h];
}

/** 임베딩·의도 파서가 같은 어휘 집합을 보도록 짧은 문맥 블록 */
export function taxonomyContextBlockForMl() {
  return [
    "JUDO_TAX",
    "liquor:" + STUDIO_LIQUOR_TYPE_OPTIONS.join("|"),
    "vibe:" + STUDIO_ATMOSPHERE_OPTIONS.join("|"),
    "snack:" + COURSE_SECOND_SNACK_OPTIONS.join("|"),
  ].join(" ");
}
