import normalizeText from "./normalizeText";
import {
  parseSearchQuery,
  REGION_KEYWORDS,
  stripPartyAndChatterForKeywordSearch,
  normalizeHangulSearchCompounds,
} from "./searchParser.js";

/** 큐레이터 닉·핸들 검색용 (사전과 무관하게 유지) */
const CURATOR_KEYWORDS = [
  "soju_anju",
  "sojuanju",
  "소주안주",
  "소주 안주",
  "mathtagoras",
  "맛타고라스",
  "맛 타고라스",
  "choiza11",
  "choiza",
  "최자",
  "와인바헌터",
  "winebar_hunter",
  "winebarhunter",
  "성수술꾼",
  "성수 술꾼",
  "seongsu_local",
  "seongsul",
];

const WALKING_KEYWORDS = [
  "도보",
  "걸어",
  "걸어서",
  "걸어가",
  "걸어갈",
  "걸어다니",
  "가까운",
  "근처",
  "근방",
];
const SAVED_SORT_KEYWORDS = ["인기", "저장많은", "저장 많은", "핫한", "유명한"];

function stripFromNormalized(remainingText, phrase) {
  const n = normalizeText(phrase);
  if (!n || n.length < 1) return remainingText;
  return remainingText.replaceAll(n, " ");
}

/**
 * 자연어 쿼리 정규화. 내부적으로 `parseSearchQuery`(+ 병합 사전)만 사용해 이중화 제거.
 * 반환 형태는 기존 호환용 필드 유지.
 */
export default function parseNaturalQuery(rawQuery = "") {
  const original = normalizeHangulSearchCompounds(String(rawQuery || "").trim());
  if (!original) {
    return {
      original: rawQuery,
      region: null,
      tags: [],
      curator: null,
      wantsWalkingDistance: false,
      sortBySaved: false,
      remainingText: "",
      facets: null,
    };
  }

  const parsed = parseSearchQuery(original);
  const normalizedFull = normalizeText(original);

  const curator =
    CURATOR_KEYWORDS.find((keyword) =>
      normalizedFull.includes(normalizeText(keyword))
    ) || null;

  const wantsWalkingDistance = WALKING_KEYWORDS.some((keyword) =>
    normalizedFull.includes(normalizeText(keyword))
  );

  const sortBySaved = SAVED_SORT_KEYWORDS.some((keyword) =>
    normalizedFull.includes(normalizeText(keyword))
  );

  const tagSet = new Set();
  for (const t of parsed.tags || []) tagSet.add(t);
  for (const key of ["alcohol", "situation", "vibe", "food"]) {
    if (parsed[key]) tagSet.add(parsed[key]);
  }
  for (const a of parsed.alcohols || []) if (a) tagSet.add(a);
  for (const s of parsed.situations || []) if (s) tagSet.add(s);
  for (const v of parsed.vibes || []) if (v) tagSet.add(v);
  for (const f of parsed.foods || []) if (f) tagSet.add(f);

  const toStrip = [
    ...CURATOR_KEYWORDS,
    ...WALKING_KEYWORDS,
    ...SAVED_SORT_KEYWORDS,
  ];
  const regionList =
    parsed.regions?.length > 0
      ? parsed.regions
      : parsed.region
        ? [parsed.region]
        : [];
  for (const reg of regionList) {
    if (REGION_KEYWORDS[reg]) toStrip.push(...REGION_KEYWORDS[reg]);
  }
  for (const label of tagSet) toStrip.push(label);

  toStrip.sort(
    (a, b) => normalizeText(b).length - normalizeText(a).length
  );

  let remainingText = normalizedFull;
  for (const kw of toStrip) {
    remainingText = stripFromNormalized(remainingText, kw);
  }

  const chatterStripped = stripPartyAndChatterForKeywordSearch(original);
  if (chatterStripped) {
    remainingText = stripFromNormalized(remainingText, chatterStripped);
  }

  remainingText = remainingText.replace(/\d{1,2}/g, " ");
  remainingText = remainingText.replace(/\s+/g, " ").trim();

  return {
    original: rawQuery,
    region: parsed.region,
    tags: Array.from(tagSet),
    curator,
    wantsWalkingDistance,
    sortBySaved,
    remainingText,
    /** `parseSearchQuery` 전체 — 로딩 문구·분석 등 구조화 필드용 */
    facets: parsed,
  };
}
