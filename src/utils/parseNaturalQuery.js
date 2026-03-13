import normalizeText from "./normalizeText";

const REGION_KEYWORDS = ["을지로", "성수", "강남", "연남", "망원", "신당", "종로"];
const TAG_KEYWORDS = [
  "노포",
  "소주",
  "맥주",
  "와인",
  "막걸리",
  "하이볼",
  "데이트",
  "2차",
  "1차",
  "혼술",
  "회식",
  "해산물",
  "안주",
  "안주맛집",
  "분위기",
  "힙함",
  "심야",
];
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
  "seongsul"
];
const WALKING_KEYWORDS = ["도보", "걸어", "걸어서", "가까운", "근처", "근방"];
const SAVED_SORT_KEYWORDS = ["인기", "저장많은", "저장 많은", "핫한", "유명한"];

export default function parseNaturalQuery(rawQuery = "") {
  const original = rawQuery.trim();
  const normalizedQuery = normalizeText(original);

  if (!original) {
    return {
      original: rawQuery,
      region: null,
      tags: [],
      curator: null,
      wantsWalkingDistance: false,
      sortBySaved: false,
      remainingText: "",
    };
  }

  const region =
    REGION_KEYWORDS.find((keyword) =>
      normalizedQuery.includes(normalizeText(keyword))
    ) || null;

  const curator =
    CURATOR_KEYWORDS.find((keyword) =>
      normalizedQuery.includes(normalizeText(keyword))
    ) || null;

  const tags = TAG_KEYWORDS.filter((keyword) =>
    normalizedQuery.includes(normalizeText(keyword))
  );

  const wantsWalkingDistance = WALKING_KEYWORDS.some((keyword) =>
    normalizedQuery.includes(normalizeText(keyword))
  );

  const sortBySaved = SAVED_SORT_KEYWORDS.some((keyword) =>
    normalizedQuery.includes(normalizeText(keyword))
  );

  let remainingText = normalizedQuery;

  [
    ...REGION_KEYWORDS,
    ...TAG_KEYWORDS,
    ...CURATOR_KEYWORDS,
    ...WALKING_KEYWORDS,
    ...SAVED_SORT_KEYWORDS,
  ]
    .sort((a, b) => b.length - a.length)
    .forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      remainingText = remainingText.replaceAll(normalizedKeyword, " ");
    });

  remainingText = remainingText.replace(/\s+/g, " ").trim();

  return {
    original: rawQuery,
    region,
    tags,
    curator,
    wantsWalkingDistance,
    sortBySaved,
    remainingText,
  };
}