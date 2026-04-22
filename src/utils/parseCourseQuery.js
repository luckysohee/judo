import {
  parseSearchQuery,
  normalizeHangulSearchCompounds,
} from "./searchParser.js";

const WALKABLE_HINTS = [
  "걸어서",
  "도보",
  "walk",
  "walking",
  "가까운",
  "근처",
];

/**
 * 코스 의도 전용 경량 파서 (MVP: 룰 기반, 나중에 intent-assist로 보강 가능).
 */
export function parseCourseQuery(query = "") {
  const text = String(normalizeHangulSearchCompounds(query) || "")
    .replace(/\s+/g, " ")
    .trim();
  const lower = text.toLowerCase();

  const facets = text ? parseSearchQuery(text) : null;
  const area = facets?.region ?? null;

  let steps = 1;
  if (text.includes("3차")) steps = 3;
  else if (text.includes("2차")) steps = 2;
  else if (/코스|루트|코스\s*짜|짜\s*줘/i.test(text)) steps = 2;

  const walkable = WALKABLE_HINTS.some((w) => lower.includes(w.toLowerCase()));

  const dateMode = text.includes("데이트")
    ? "date"
    : text.includes("회식")
      ? "group"
      : text.includes("혼술")
        ? "solo"
        : "casual";

  const rightNow =
    /지금|오늘|당장|바로/i.test(text);

  return {
    raw: text,
    area,
    steps,
    walkable,
    dateMode,
    rightNow,
    /** `dateMode`와 동일 — 코스 엔진·훅에서 공통 이름 */
    mode: dateMode,
    theme: "drinking_course",
    facets,
  };
}
