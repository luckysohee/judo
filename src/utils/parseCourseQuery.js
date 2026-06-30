import {
  parseSearchQuery,
  normalizeHangulSearchCompounds,
  findAreaKeywordInQuery,
  extractLocationAnchorFromQuery,
  regionKeyForLocationToken,
  REGION_KEYWORDS,
} from "./searchParser.js";

const WALKABLE_HINTS = [
  "걸어서",
  "도보",
  "walk",
  "walking",
  "가까운",
  "근처",
];

function parsePartySizeFromText(text) {
  const q = String(text || "");
  const m = q.match(/(\d{1,2})\s*(?:명|인)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(20, Math.floor(n));
}

/** 코스 문장에서 지명 후보로 쓰지 않는 토큰 */
const COURSE_NON_LOCATION_TOKENS = new Set([
  "데이트",
  "코스",
  "루트",
  "짜줘",
  "짜기",
  "회식",
  "혼술",
  "추천",
  "근처",
  "주변",
  "1차",
  "2차",
  "3차",
  "일차",
  "이차",
  "삼차",
  "걸어서",
  "도보",
]);

/**
 * `REGION_KEYWORDS`에 아직 없는 생활 지명 → 기존 클러스터 키.
 * 새 동네는 여기 한 줄 추가(코스 `area`만 보강 — 일반 지도 검색 파서와 분리).
 */
const COURSE_LEADING_TOKEN_TO_AREA = {
  상수: "홍대",
  연남: "홍대",
  서교: "홍대",
  합정: "홍대",
  망원: "홍대",
  서강: "홍대",
  /** 창신·숭인·동묘·동대문 */
  동묘: "동대문",
  동묘앞: "동대문",
  동대문: "동대문",
  창신: "동대문",
  숭인: "동대문",
  /** 혜화·대학로 */
  혜화: "혜화",
  혜화동: "혜화",
  대학로: "혜화",
  이화: "혜화",
  명륜: "혜화",
  문정: "문정",
  문정역: "문정",
  /** 성수 인접 미세 권역 — 코스 장소 풀은 성수 클러스터 사용 */
  서울숲: "성수",
  뚝섬: "성수",
  건대: "건대",
  건대입구: "건대",
};

/** 코스 장소 풀(`COURSE_AREA_CORE`) — 성수 인접 미세 권역은 성수 클러스터로 합침 */
const COURSE_AREA_POOL_ALIAS = {
  서울숲: "성수",
  뚝섬: "성수",
};

function regionKeyForExactSynonym(tokenLower) {
  if (!tokenLower) return null;
  for (const [region, syns] of Object.entries(REGION_KEYWORDS)) {
    for (const s of syns) {
      if (String(s).toLowerCase() === tokenLower) return region;
    }
  }
  return null;
}

/**
 * `parseSearchQuery().region`이 비었을 때: 지도 앵커 동의어 일치 → 선두 토큰 맵.
 */
function resolveCourseArea(text, facets) {
  let area = facets?.region ?? null;
  if (!area && text) {
    const hit = findAreaKeywordInQuery(text);
    if (hit) {
      area =
        regionKeyForLocationToken(hit) ||
        regionKeyForExactSynonym(String(hit).toLowerCase());
    }
  }
  if (!area && text) {
    const anchor = extractLocationAnchorFromQuery(text);
    if (anchor) {
      area =
        regionKeyForLocationToken(anchor) ||
        COURSE_LEADING_TOKEN_TO_AREA[anchor] ||
        COURSE_LEADING_TOKEN_TO_AREA[anchor.replace(/(역|동)$/u, "")] ||
        null;
      /** 사전에 없는 `OO동` — 주소·상호에 그 글자가 있으면 `placeMatchesArea`가 잡음 */
      if (!area) {
        const literal = anchor.replace(/(역|동)$/u, "") || anchor;
        if (literal.length >= 2 && !COURSE_NON_LOCATION_TOKENS.has(literal)) {
          area = literal;
        }
      }
    }
  }
  if (!area && text) {
    const words = text.split(/\s+/).filter(Boolean);
    for (const w of words.slice(0, 5)) {
      const plain = w.replace(/[^0-9a-z\uAC00-\uD7A3]/gi, "");
      if (plain.length < 2) continue;
      if (COURSE_NON_LOCATION_TOKENS.has(plain)) continue;
      const stripped = plain.replace(/(역|동)$/u, "");
      const fromMap =
        COURSE_LEADING_TOKEN_TO_AREA[plain] ||
        (stripped.length >= 2 ? COURSE_LEADING_TOKEN_TO_AREA[stripped] : null);
      if (fromMap) {
        area = fromMap;
        break;
      }
    }
  }
  if (area && COURSE_AREA_POOL_ALIAS[area]) {
    area = COURSE_AREA_POOL_ALIAS[area];
  }
  return area;
}

/**
 * 코스 의도 전용 경량 파서 (MVP: 룰 기반, 나중에 intent-assist로 보강 가능).
 * @param {{ includeHalfStep?: boolean }} [options] — UI에서 「쩜오차」 포함 시 true. 1·2차 사이 달달 구간을 넣을지 여부
 */
export function parseCourseQuery(query = "", options = {}) {
  const text = String(normalizeHangulSearchCompounds(query) || "")
    .replace(/\s+/g, " ")
    .trim();
  const lower = text.toLowerCase();

  const facets = text ? parseSearchQuery(text) : null;
  const area = resolveCourseArea(text, facets);

  let steps = 1;
  if (text.includes("3차")) steps = 3;
  else if (text.includes("2차")) steps = 2;
  else if (/코스|루트|코스\s*짜|짜\s*줘/i.test(text)) steps = 2;

  const includeHalfStep = Boolean(options.includeHalfStep);

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
  const partySize =
    parsePartySizeFromText(text) ?? (dateMode === "date" ? 2 : null);

  return {
    raw: text,
    area,
    steps,
    includeHalfStep,
    walkable,
    dateMode,
    rightNow,
    partySize,
    /** `dateMode`와 동일 — 코스 엔진·훅에서 공통 이름 */
    mode: dateMode,
    theme: "drinking_course",
    facets,
  };
}
