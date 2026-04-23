// 룰 기반 검색 파서 - 자연어를 필터로 변환
// (5단계) LLM 보조: `/api/search-intent-assist` + `searchAIAssistant.js` — 지도/API가 후보, AI는 태그·키워드만.
// (7단계) ML 착수 조건·ML 전 룰/집계: `searchPhase7Guidance.js`
// (8단계) 검색바 최종 형태(똑똑한 지도 검색창) 계약: `searchPhase8SearchBar.js`
// (9단계) 당장 우선순위·나중 작업: `searchPhase9Priorities.js`

import { SEARCH_DICTIONARY } from "./searchDictionary.js";
import { findCuratorCatalogMatch } from "./mergePickedPlaceWithCuratorCatalog.js";

function uniqConcat(priorityFirst, second) {
  const seen = new Set();
  const out = [];
  for (const x of [...priorityFirst, ...(second || [])]) {
    if (x && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/** 레거시 지역(부산·제주 등) + `SEARCH_DICTIONARY.regions` 병합. 압구정은 강남보다 먼저 매칭. */
function buildRegionKeywords() {
  const LEGACY = {
    강남: ["강남", "강남구", "강남역", "신사", "압구정", "청담", "논현"],
    홍대: ["홍대", "홍대입구", "합정", "상수", "망원"],
    성수: ["성수", "성수역", "성수동", "성수로", "서울숲", "뚝섬"],
    을지로: ["을지로", "을지로입구", "을지로3가", "을지로4가", "을지로5가", "동대문"],
    종로: ["종로", "종로3가", "종로5가", "광화문", "시청", "서울역"],
    명동: ["명동", "명동입구", "회현", "충무로"],
    신촌: ["신촌", "이대", "아현", "공덕"],
    잠실: ["잠실", "잠실역", "송파", "문정", "복정"],
    부산: ["부산", "서면", "해운대", "광안리", "남포동"],
    대구: ["대구", "동성로", "중앙로", "반월당"],
    제주: ["제주", "제주시", "애월", "협재", "성산"],
  };

  const out = {};
  for (const [k, v] of Object.entries(LEGACY)) {
    out[k] = [...v];
  }
  for (const [k, v] of Object.entries(SEARCH_DICTIONARY.regions)) {
    out[k] = uniqConcat(v, out[k]);
  }

  if (out.압구정?.length && out.강남?.length) {
    const 압 = new Set(out.압구정);
    out.강남 = out.강남.filter((s) => !압.has(s));
  }
  if (out.한남?.length && out.강남?.length) {
    const hn = new Set(out.한남);
    out.강남 = out.강남.filter((s) => !hn.has(s));
  }

  const ORDER = [
    "압구정",
    "한남",
    "홍대",
    "성수",
    "을지로",
    "강남",
    "종로",
    "명동",
    "신촌",
    "잠실",
    "부산",
    "대구",
    "제주",
  ];
  const ordered = {};
  for (const k of ORDER) {
    if (out[k]) ordered[k] = out[k];
  }
  for (const k of Object.keys(out)) {
    if (!ordered[k]) ordered[k] = out[k];
  }
  return ordered;
}

// 지역 키워드 사전 (검색 확장 UX에서도 사용)
export const REGION_KEYWORDS = buildRegionKeywords();

/**
 * `홍대` 클러스터 동의어에 합정·상수 등이 포함돼 있어, 쿼리에 그 동명이 직접 들어가면
 * 상호·주소에 해당 글자가 있는 장소만 통과(「합정 와인바」인데 망원만 나오는 혼선 방지).
 * `홍대`만 쓴 검색은 기존처럼 클러스터 전체 동의어를 허용.
 */
const HONGDAE_QUERY_STRICT_SUBTOKENS = [
  "합정",
  "상수",
  "망원",
  "홍대입구",
];

function queryPinsHongdaeStrictSubtoken(rawQuery) {
  const q = String(rawQuery || "").toLowerCase();
  return HONGDAE_QUERY_STRICT_SUBTOKENS.some((t) => q.includes(t.toLowerCase()));
}

/**
 * 쿼리에 명시된 지역·랜드마크 (Kakao 키워드 앵커).
 * "동대문 근처 …"에서 근처는 GPS가 아니라 동대문 쪽이어야 하므로 `역/동` 정규식에 안 잡히는 이름도 여기서 잡는다.
 * 가장 긴 매칭을 우선(예: 강남역 vs 강남).
 */
export function findAreaKeywordInQuery(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const synonyms of Object.values(REGION_KEYWORDS)) {
    for (const s of synonyms) {
      if (s.length < 2) continue;
      if (lower.includes(s.toLowerCase()) && s.length >= bestLen) {
        best = s;
        bestLen = s.length;
      }
    }
  }
  const EXTRA = [
    "압구정로데오",
    "가로수길",
    "성수연무장",
    "연남동",
    "망원동",
    "이태원",
    "여의도",
    "한강공원",
    "건대입구",
    "건대",
    "혜화",
    "왕십리역",
    "왕십리",
    "을지로입구",
    "을지로3가",
    "종로3가",
    "광화문",
  ];
  for (const s of EXTRA) {
    if (q.includes(s) && s.length >= bestLen) {
      best = s;
      bestLen = s.length;
    }
  }
  return best;
}

/**
 * 쿼리에서 `OO역`, `OO동`, `OO구`, `OO대로`, `OO로`, `OO거리`, `OO시장` 형태의 지리 앵커 추출.
 * JS `\\w+역`은 한글을 포함하지 않아 `문정역` 등에서 매칭되지 않음.
 */
export function extractLocationAnchorFromQuery(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  const HN = "[\\uAC00-\\uD7A30-9()]";
  const H = "[\\uAC00-\\uD7A3]";
  const bodies = [
    `${HN}+역`,
    `${HN}+동`,
    `${HN}+구`,
    `${H}[\\uAC00-\\uD7A30-9A-Za-z\\s]+대로`,
    `${H}[\\uAC00-\\uD7A30-9A-Za-z\\s]+로(?:\\s*\\d+가)?`,
    `${HN}+거리`,
    `${HN}+시장`,
  ];
  for (const body of bodies) {
    const m = q.match(new RegExp(`(${body})`));
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  const ascii = q.match(
    /(\w+역|\w+동|\w+구|\w+대로|\w+로|\w+거리|\w+시장)/
  );
  return ascii ? ascii[1] : null;
}

/**
 * 짧은 「지명·역·동 + 메뉴·키워드」 단순 검색 — 자연어 추천 UI 대신 지도 마커 위주로 둘 때 쓴다.
 */
export function isSimpleLocationMenuMapQuery(query) {
  const q = String(query || "").trim();
  if (!q || q.length > 44) return false;
  const loc = extractLocationAnchorFromQuery(q);
  if (!loc) return false;
  const escapedLoc = loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let tail;
  try {
    tail = q.replace(new RegExp(escapedLoc, "g"), "").trim();
  } catch {
    tail = q.split(loc).join("").trim();
  }
  if (!tail || tail.length < 2) return false;
  if (/[?.!]/.test(tail)) return false;
  if (/어디|추천\s|같은\s*맛|하고\s*싶|하면\s*좋|알려줘|찾아줘/.test(tail)) {
    return false;
  }
  const words = tail.split(/\s+/).filter(Boolean);
  if (words.length > 6) return false;
  if (q.length > 32 && words.length > 4) return false;
  return true;
}

/**
 * 원문 `query`만 보고 문장·추천·장문 의도인지 (naturalQ 없이).
 * 분기 우선순위: 1) 사용자 원문 query → 2) naturalQ 보조 (충돌 시 query 쪽이 이 함수로 이미 고정됨).
 */
export function isLikelyNaturalLanguageFromQueryOnly(query) {
  const q = String(query || "").trim();
  if (!q) return false;
  if (
    /걸어서|걸어가기|걸어갈|걸어다니|도보\s|가까운\s*곳|분위기|데이트|연인|회식|혼술|늦게까지|가성비|조용한|조용하게|시끌|로맨틱|조용히|혼자|친구랑|가족이랑|노포|옛날감성|로컬|숨은맛집|전통/i.test(
      q
    )
  ) {
    return true;
  }
  if (/추천|알려줘|찾아줘|어디가\s*좋|골라줘|뭐가\s*좋|어디\s*갈지/i.test(q)) {
    return true;
  }
  if (q.length > 34) return true;
  if (
    /[.!?]|습니다|해요\s*$|예요\s*$|까요\s*$|같아요|하고\s*싶|보여줘|알려줘/i.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * 지역명 + 2~3 토큰 명사형 조합(와인바·이자카야·2차·소개팅 등) — 키워드 검색으로 충분한 경우.
 * 문장 접속·서술(에서 조용하게…, 끝나고…)이 있으면 false.
 */
const KEYWORD_NOUN_COMPOUND_CLAUSE_RE =
  /(?:^|\s)(?:에서|에게|한테)\s|하게|하러|해서|인데|지만|조용하게|얘기하기|대화할|가기\s*좋은|끝나고|비\s*오는데|실내에서|한잔할만|할만한|수\s*있는|추천해줘|골라줘|얘기\s*하기|대화\s*할/i;

/** 명사 조합으로 보려다가는 AI로 보내야 하는 단독 꼬리 토큰(짧은 쿼리 한정) */
const KEYWORD_NOUN_COMPOUND_TAIL_BLOCK_RE =
  /^(노포|옛날감성|로컬|숨은맛집|전통|데이트|로맨틱|회식|혼술|뒷풀이|분위기|느낌|상황)$/i;

export function isKeywordShortNounCompoundQuery(query) {
  const q = String(query || "").trim();
  if (!q || q.length > 28) return false;
  if (KEYWORD_NOUN_COMPOUND_CLAUSE_RE.test(q)) return false;
  if (
    /[.]|[?]|습니다|해요|까요|같아요|하고\s*싶|보여줘|알려줘|추천|어디가\s*좋|찾아줘/i.test(
      q
    )
  ) {
    return false;
  }

  const loc = extractLocationAnchorFromQuery(q) || findAreaKeywordInQuery(q);
  if (!loc) return false;

  let tail;
  try {
    const escaped = String(loc).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    tail = q.replace(new RegExp(escaped, "g"), "").trim();
  } catch {
    tail = q.split(String(loc)).join("").trim();
  }
  if (!tail || tail.length < 2) return false;
  const tailOne = tail.replace(/\s+/g, " ").trim();
  if (KEYWORD_NOUN_COMPOUND_TAIL_BLOCK_RE.test(tailOne)) return false;

  const words = q.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 3) return false;

  return true;
}

/**
 * 자연어·조건이 많은 검색으로 보이면 단순 마커 전용 UX를 쓰지 않는다.
 * (`parseNaturalQuery`의 wantsWalkingDistance에는 "근처"가 포함되어 있어 여기서는 쓰지 않음.)
 *
 * **원문 우선**: 짧은 명사 조합(지역+업종)이면 naturalQ가 길어도 false로 두어 query가 이긴다.
 */
export function isLikelyNaturalLanguageSearchQuery(query, naturalQ) {
  const q = String(query || "").trim();
  if (!q) return false;
  if (isKeywordShortNounCompoundQuery(q)) return false;
  if (isLikelyNaturalLanguageFromQueryOnly(q)) return true;
  if (!naturalQ) return q.length > 28;
  if (naturalQ.sortBySaved) return true;
  if (naturalQ.curator) return true;
  if (q.length > 40) return true;
  const tags = naturalQ.tags || [];
  if (tags.length >= 4) return true;
  const rem = String(naturalQ.remainingText || "")
    .replace(/\s+/g, " ")
    .trim();
  if (rem.length > 16) return true;
  return false;
}

/**
 * 홈 단일 검색창 기준 실행 종류 (UI·채널 토글 없이 입력만으로 분기).
 *
 * - `keyword_search`: 토큰 짧고 지역·카테고리(메뉴·술 종류) 중심 → 카카오 키워드 위주 파이프라인 (`basic`).
 * - `ai_parse_search`: 문장·조건·분위기 서술 → 의도 파싱·통합 검색 파이프라인 (`ai`).
 *
 * **판별 우선순위 (충돌 시 상위가 이김)**  
 * 1. 사용자 원문 `query` (명사형 짧은 조합·문장 신호)  
 * 2. `naturalQ`는 보조(큐레이터·저장순·긴 remaining 등) — 원문이 이미 키워드 조합이면 naturalQ로 AI에 끌려가지 않음.
 *
 * 추천 이유·재정렬은 여기 붙이지 않는다 (`searchParser` = 타입 판별만).
 *
 * **버튼 의존 로직 제거**: 예전 `homeSearchChannel` 제거, 이 함수 + `naturalQ` 보조만 사용.
 *
 * @see inferSearchPipelineMode — 레거시 호환용 `"basic" | "ai"` 문자열 매핑만 담당.
 */
export const HOME_SEARCH_KIND = Object.freeze({
  KEYWORD_SEARCH: "keyword_search",
  AI_PARSE_SEARCH: "ai_parse_search",
});

/** 분위기·상황·행동 표현(키워드만 검색으로 처리하기 애매한 서술) */
const AI_PARSE_MOOD_SITUATION_ACTION_RE =
  /가볼만|가볼까|먹으러|마시러|놀러|모이기|만나기|분위기\s*좋|느낌\s*있|상황에\s*맞|같은\s*느낌|어떤\s*느낌|기분\s*전환|분위기\s*있는/i;

/**
 * @param {string} query
 * @param {object | null | undefined} naturalQ `parseNaturalQuery` 결과(없으면 null)
 * @returns {typeof HOME_SEARCH_KIND[keyof typeof HOME_SEARCH_KIND]}
 */
export function detectHomeSearchExecutionKind(query, naturalQ = null) {
  const q = String(query || "").trim();
  if (!q) return HOME_SEARCH_KIND.KEYWORD_SEARCH;

  /** 1차: 원문 — 짧은 지역+명사 조합은 키워드 우선 */
  if (isKeywordShortNounCompoundQuery(q)) {
    return HOME_SEARCH_KIND.KEYWORD_SEARCH;
  }

  /** 원문만으로도 문장·장문이면 AI */
  if (isLikelyNaturalLanguageFromQueryOnly(q)) {
    return HOME_SEARCH_KIND.AI_PARSE_SEARCH;
  }

  if (isSimpleLocationMenuMapQuery(q)) {
    return HOME_SEARCH_KIND.KEYWORD_SEARCH;
  }

  /** 2차: naturalQ 보조 (원문이 짧은 키워드 조합이면 위에서 이미 종료) */
  if (naturalQ?.curator) return HOME_SEARCH_KIND.AI_PARSE_SEARCH;
  if (naturalQ?.sortBySaved) return HOME_SEARCH_KIND.AI_PARSE_SEARCH;

  if (!naturalQ && q.length > 28) {
    return HOME_SEARCH_KIND.AI_PARSE_SEARCH;
  }

  const tags = naturalQ?.tags || [];
  const rem = String(naturalQ?.remainingText || "")
    .replace(/\s+/g, " ")
    .trim();
  if (tags.length >= 4 || rem.length > 16) {
    return HOME_SEARCH_KIND.AI_PARSE_SEARCH;
  }

  if (AI_PARSE_MOOD_SITUATION_ACTION_RE.test(q)) {
    return HOME_SEARCH_KIND.AI_PARSE_SEARCH;
  }

  if (q.length <= 24 && !/[?!]/.test(q)) {
    if (
      !/추천|알려|어디|뭐가|골라|찾아줘|해줘|좋은데|느낌|상황|뭐\s*먹/i.test(q)
    ) {
      const words = q.split(/\s+/).filter(Boolean);
      if (words.length <= 4) {
        if (extractLocationAnchorFromQuery(q) || findAreaKeywordInQuery(q)) {
          return HOME_SEARCH_KIND.KEYWORD_SEARCH;
        }
      }
    }
  }

  /** 가게명·브랜드형만 — «얘기하기 좋은 바»·«오늘 가볍게 한잔» 같은 서술은 제외 */
  const shortVerbOrNarrativeCompact = q.replace(/\s+/g, "");
  if (
    q.length <= 16 &&
    q.split(/\s+/).filter(Boolean).length <= 3 &&
    !/하기|가볍게|한잔|끝나고|분위기|얘기하기|좋은바|오늘|실내|대화|갈만한/i.test(
      shortVerbOrNarrativeCompact
    )
  ) {
    return HOME_SEARCH_KIND.KEYWORD_SEARCH;
  }

  return HOME_SEARCH_KIND.AI_PARSE_SEARCH;
}

/**
 * 레거시·다른 모듈 호환: `"basic"` = keyword_search, `"ai"` = ai_parse_search.
 * 신규 코드는 `detectHomeSearchExecutionKind` 사용을 권장.
 */
export function inferSearchPipelineMode(query, naturalQ) {
  return detectHomeSearchExecutionKind(query, naturalQ) ===
    HOME_SEARCH_KIND.KEYWORD_SEARCH
    ? "basic"
    : "ai";
}

/**
 * `extractLocationAnchorFromQuery`가 이미 잡은 OO구·OO동 등은
 * «강남» 같은 짧은 별칭으로 덮어쓰지 않는다. ("강남구" → 강남 치환 시 tail이 "구"만 남는 버그 방지)
 */
export function shouldKeepExtractedLocationForMapSearch(extracted) {
  const s = String(extracted || "").replace(/\s+/g, "").trim();
  if (!s) return false;
  return /(구|시|군|동|읍|면|리|역|로|거리|시장|대로)$/.test(s);
}

/**
 * 홈 지도 검색과 동일 규칙으로 지명 추출 (`성수 데이트 코스` → 성수 등).
 * 코스 검색에서 지역 앵커 좌표를 잡을 때 재사용한다.
 */
export function extractHomeMapLocationName(kwForMap) {
  const q = String(kwForMap || "").trim();
  if (!q) return null;
  let locationName = extractLocationAnchorFromQuery(q);
  if (!shouldKeepExtractedLocationForMapSearch(locationName)) {
    if (q.includes("동대문")) locationName = "동대문";
    else if (q.includes("성수")) locationName = "성수";
    else if (q.includes("강남")) locationName = "강남";
    else if (q.includes("삼성")) locationName = "삼성";
    else if (q.includes("서울")) locationName = "서울";
  }
  if (!locationName) {
    locationName = findAreaKeywordInQuery(q);
  }
  const out = locationName ? String(locationName).trim() : "";
  return out || null;
}

/**
 * 붙여 쓴 흔한 검색어를 띄어쓴 형태로 통일 (`데이트코스` → `데이트 코스`).
 * 코스 의도·지역 파서·단어 개수 추론이 띄어쓰기에만 맞춰져 있을 때 동일하게 동작하게 한다.
 * 여러 번 적용해도 안전하다.
 */
export function normalizeHangulSearchCompounds(query) {
  let q = String(query || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return q;
  const pairs = [
    [/데이트코스/giu, "데이트 코스"],
    [/회식코스/giu, "회식 코스"],
    [/혼술코스/giu, "혼술 코스"],
    [/소개팅코스/giu, "소개팅 코스"],
    [/1차코스/giu, "1차 코스"],
    [/2차코스/giu, "2차 코스"],
    [/3차코스/giu, "3차 코스"],
    [/일차코스/giu, "일차 코스"],
    [/이차코스/giu, "이차 코스"],
    [/삼차코스/giu, "삼차 코스"],
  ];
  for (const [re, rep] of pairs) {
    q = q.replace(re, rep);
  }
  return q.replace(/\s+/g, " ").trim();
}

function mapSearchGeoOnlyTailIsEffectivelyEmpty(tail) {
  const t = String(tail || "").trim();
  if (!t) return true;
  const c = t.replace(/\s+/g, "");
  /** 별칭 치환 찌꺼기 */
  if (/^(구|시|군)$/u.test(c)) return true;
  /** 지명만 + 근처/주변 (맛집 의도 없음) */
  if (/^(근처|주변|부근|일대|쪽)$/u.test(c)) return true;
  return false;
}

/**
 * 지도 검색에서 «지역·역·동 등만» 입력한 경우(맛집·술집 등 의도 없음) — 줌만 하고 결과·마커는 생략.
 */
export function isMapGeographicPanOnlyQuery({
  locationName,
  intentPhraseMap,
  tailAfterLocationMap,
}) {
  if (!locationName) return false;
  if (intentPhraseMap) return false;
  return mapSearchGeoOnlyTailIsEffectivelyEmpty(tailAfterLocationMap);
}

function buildAlcoholKeywords() {
  const LEGACY = {
    소주: ["소주", "새로", "참이슬", "시원", "한잔"],
    맥주: ["맥주", "생맥", "수제맥", "크래프트", "draft", "페일에일", "IPA"],
    와인: ["와인", "레드와인", "화이트와인", "wine", "잔", "보르도", "부르고뉴"],
    하이볼: ["하이볼", "칵테일", "진토닉", "모히토", "맥주콜라", "위스키"],
    양주: ["양주", "위스키", "진", "보드카", "럼", "테킬라"],
    사케: ["사케", "청주", "일본술"],
    막걸리: ["막걸리", "탁주", "생막걸리", "전주"],
    고량주: ["고량주", "바이주", "白酒", "중국술", "마오타이"],
    전통주: ["전통주", "한국주", "소곡주", "약주"],
  };
  const out = { ...LEGACY };
  for (const [k, v] of Object.entries(SEARCH_DICTIONARY.alcohols)) {
    out[k] = uniqConcat(v, out[k]);
  }
  return out;
}

const ALCOHOL_KEYWORDS = buildAlcoholKeywords();

function buildSituationKeywords() {
  const LEGACY = {
    "1차": ["1차", "첫차", "첫잔", "시작"],
    "2차": ["2차", "이차", "둘째잔", "뒷풀이", "after"],
    데이트: ["데이트", "연인", "커플", "둘만", "로맨틱"],
    회식: ["회식", "동료", "직장", "팀", "부서", "석식"],
    혼술: ["혼술", "혼자", "나만", "solo", "싱글"],
    생일: ["생일", "생일파티", "birthday", "축하"],
    기념일: ["기념일", "anniversary", "축하", "기념"],
    모임: ["모임", "친구", "지인", "손님", "만남"],
  };
  const out = { ...LEGACY };
  for (const [k, v] of Object.entries(SEARCH_DICTIONARY.purposes)) {
    out[k] = uniqConcat(v, out[k]);
  }
  return out;
}

const SITUATION_KEYWORDS = buildSituationKeywords();

function buildVibeKeywords() {
  const LEGACY = {
    조용한: ["조용한", "조용", "차분한", "얌전한", "quiet", "편안한"],
    시끌벅적: ["시끌벅적", "시끌", "활기", "lively", "noisy", "북적"],
    감성: ["감성", "감성적", "분위기", "인스타", "예쁜", "아기자기"],
    트렌디: ["트렌디", "trendy", "힙", "cool", "유행"],
    클래식: ["클래식", "classic", "전통", "원조", "오래된"],
    락바: ["락바", "rock", "음악", "band", "live"],
    재즈: ["재즈", "jazz", "爵士", "앰비언트"],
    이국적: ["이국적", "exotic", "외국", "해외"],
  };
  const out = { ...LEGACY };
  for (const [k, v] of Object.entries(SEARCH_DICTIONARY.vibes)) {
    out[k] = uniqConcat(v, out[k]);
  }
  return out;
}

const VIBE_KEYWORDS = buildVibeKeywords();

function buildFoodKeywords() {
  const LEGACY = {
    해산물: [
      "해산물",
      "횟집",
      "회집",
      "생선회",
      "해물",
      "생선",
      "조개",
      "게",
      "새우",
      "낙지",
      "오징어",
      "문어",
      "전복",
      "꽁치",
    ],
    육류: ["고기", "육류", "소고기", "돼지고기", "닭고기", "갈비", "삼겹살", "목살", "닭갈비"],
    한식: ["한식", "한국", "김치", "비빔밥", "불고기", "갈비", "된장", "순두부"],
    일식: ["일식", "일본", "초밥", "사시미", "라멘", "우동", "돈까스", "덮밥"],
    중식: ["중식", "중국", "짜장", "짬뽕", "볶음밥", "마라", "꿔바로우"],
    양식: ["양식", "서양", "스테이크", "파스타", "피자", "리조또", "샐러드"],
    분식: ["분식", "떡볶이", "순대", "김밥", "라면", "튀김", "호떡"],
    카페: ["카페", "coffee", "디저트", "케이크", "빵", "pastry"],
    해장: ["해장", "숙취", "해장국", "콩나물", "북엇국", "순대국", "뼈해장"],
  };
  const out = { ...LEGACY };
  for (const [k, v] of Object.entries(SEARCH_DICTIONARY.foods)) {
    out[k] = uniqConcat(v, out[k]);
  }
  return out;
}

const FOOD_KEYWORDS = buildFoodKeywords();

/** `SEARCH_DICTIONARY.tags` — 파싱·칩용 (여러 개 동시 매칭 가능) */
const SEARCH_TAG_KEYWORDS = { ...SEARCH_DICTIONARY.tags };

function uniqStrings(list) {
  const seen = new Set();
  const out = [];
  for (const x of list || []) {
    if (x && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/** "3명", "5명인데", "5인" 등 — 한글 뒤에는 \\b가 안 먹을 수 있어 \\b 미사용 */
export function parsePartySize(query) {
  const q = String(query || "");
  const m = q.match(/(\d{1,2})\s*명/) || q.match(/(\d{1,2})\s*인\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n) || n < 1) return null;
  return Math.min(n, 40);
}

/** 카카오 키워드 검색용: 인원·구어 제거 */
export function stripPartyAndChatterForKeywordSearch(query) {
  return String(query || "")
    .replace(/\d{1,2}\s*명/gi, " ")
    .replace(/\d{1,2}\s*인\b/gi, " ")
    .replace(/우리\s*지금|우리는|우리가|지금\s*우리/gi, " ")
    .replace(/에서(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 해산물 의도일 때 카카오 후보를 넓히기 위한 동의어 쿼리(앞부분 지명 유지).
 * 예: "신림역 해산물" → 신림역 횟집, 신림역 생선회 …
 */
export function expandFoodKakaoQueries(keyword) {
  const k = String(keyword || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!k) return [];
  const out = new Set([k]);
  if (k.includes("해산물")) {
    const replacements = [
      "횟집",
      "해물",
      "해물탕",
      "생선회",
      "회집",
      "참치",
      "오징어",
      "조개구이",
      "물회",
    ];
    for (const rep of replacements) {
      const next = k.replace(/해산물/g, rep).replace(/\s+/g, " ").trim();
      if (next && next !== k) out.add(next);
    }
  }
  if (/야장|노천주점|야외술집|야외\s*테라스/i.test(k)) {
    const withYajang = `${k} 야장`.replace(/\s+/g, " ").trim();
    out.add(withYajang);
    const compact = k.replace(/술집|주점|호프|펍/g, " ").replace(/\s+/g, " ").trim();
    if (compact && compact.length >= 2) {
      out.add(`${compact} 야장`.replace(/\s+/g, " ").trim());
    }
  }
  /** 「노포」는 카카오 키워드에 잘 안 붙는 경우가 많아 지명+주점류 동의어로 후보를 넓힌다. */
  if (/노포/i.test(k)) {
    for (const syn of ["주점", "호프", "술집", "포장마차", "이자카야"]) {
      const next = k
        .replace(/\s*노포\s*/gi, ` ${syn} `)
        .replace(/\s+/g, " ")
        .trim();
      if (next && next !== k) out.add(next);
    }
  }
  return [...out].slice(0, 10);
}

/**
 * 지도 키워드 검색에서 `category_group_code: FD6`(음식점)만 걸면
 * 「노포·주점」처럼 이름에 음식점 키워드가 약한 술집 후보가 거의 안 나오는 경우가 있다.
 * 이때는 카테고리 제한 없이 키워드만으로 넓게 받는다.
 */
export function kakaoMapSearchWantsBroadPlaceCategories(keyword) {
  const k = String(keyword || "").trim();
  return /노포|옛날감성|골목술|술집|호프|주점|포장마차|포차|이자카야|와인바|맥주|소주|하이볼|2차|야장|펍|클럽|라운지|칵테일|혼술|회식\s*술|술\s*마실/i.test(
    k
  );
}

/**
 * 역·동·구 등이 있으면 카카오 keywordSearch에 bounds를 넣지 않는다.
 * (지도 뷰가 다른 동네일 때 API가 빈 결과를 주는 문제 방지)
 *
 * @param {string} [regionAnchor] `extractLocationAnchorFromQuery` 등으로 뽑힌 지역 토큰(예: 성수) — 키워드에 포함되면 지리 앵커로 간주
 */
export function kakaoQueryHasGeographicAnchor(keyword, regionAnchor) {
  const k = String(keyword || "");
  const ra = regionAnchor && String(regionAnchor).trim();
  if (ra && k.includes(ra)) return true;
  return (
    k.includes("역") ||
    k.includes("동") ||
    k.includes("구") ||
    k.includes("대로") ||
    k.includes("로") ||
    k.includes("거리") ||
    k.includes("시장")
  );
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 지도 검색에서 추출된 지역명(성수 등)에 대응하는 REGION_KEYWORDS 동의어(소문자) */
function synonymsForExtractedMapLocation(locationName) {
  const ln = String(locationName || "").trim().toLowerCase();
  if (!ln) return [];
  for (const syns of Object.values(REGION_KEYWORDS)) {
    const hit = syns.some((s) => {
      const sl = String(s).toLowerCase();
      return sl === ln || ln.includes(sl) || sl.includes(ln);
    });
    if (hit) return syns.map((s) => String(s).toLowerCase());
  }
  return [ln];
}

function placeMatchesMapRegionAnchor(place, locationName) {
  const ln = String(locationName || "").trim();
  if (!ln) return true;
  const hay = `${place?.address_name || ""} ${place?.road_address_name || ""} ${place?.place_name || ""}`.toLowerCase();
  const syns = synonymsForExtractedMapLocation(ln);
  return syns.some((s) => s.length >= 2 && hay.includes(s));
}

/**
 * 지명이 있는 전체 지도 검색에서, 스코어링 직후 후보만 남긴다.
 * 주소·상호에 동의어가 없어도 `sortOrigin`(지도 중심) 기준 `maxDistanceKm` 안이면 유지하고,
 * 남양주처럼 먼 좌표는 제외한다(통합 API·DB 병합 오염 방지).
 */
export function filterMapSearchPlacesByRegionProximity(
  places,
  { sortOrigin = null, locationName = "", maxDistanceKm = 12 } = {},
) {
  const ln = String(locationName || "").trim();
  if (!ln || !Array.isArray(places) || places.length === 0) return places;

  return places.filter((p) => {
    const lat = parseFloat(p.y ?? p.lat);
    const lng = parseFloat(p.x ?? p.lng);
    const hasOrigin =
      sortOrigin &&
      Number.isFinite(sortOrigin.lat) &&
      Number.isFinite(sortOrigin.lng);
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
    /** 좌표 + 기준점이 있으면 반드시 거리로 제한(텍스트만 맞고 20km 밖 남양주 등 제외) */
    if (hasOrigin && hasPoint) {
      return (
        haversineKm(sortOrigin.lat, sortOrigin.lng, lat, lng) <= maxDistanceKm
      );
    }
    if (placeMatchesMapRegionAnchor(p, ln)) return true;
    return false;
  });
}

/**
 * intentAssist 없이 ai_parse 지도 검색일 때 — 자연어 원문 대신 카카오에 넘길 규칙 기반 키워드 후보(우선순위 순).
 */
export function buildAiParseMapFallbackQueries(
  rawQuery,
  extractedRegion,
  parsedFacets = null,
) {
  const region = String(extractedRegion || "").trim();
  if (!region) return [];
  const q = String(rawQuery || "");
  const vibeList = Array.isArray(parsedFacets?.vibes)
    ? parsedFacets.vibes
    : [];
  const quietFromFacets = vibeList.some((v) =>
    /조용|차분|한적|잔잔/i.test(String(v)),
  );
  const quiet =
    quietFromFacets ||
    /조용|차분|한적|잔잔/i.test(String(parsedFacets?.vibe || "")) ||
    /조용|차분|한적/i.test(q);
  if (quiet) {
    return [`${region} 조용한 카페`];
  }
  const dating = /소개팅|데이트/i.test(q);
  const after =
    /끝나고|2차|이차|이후|후\s*갈|갈만한|다음에|다음\s*에|뒷풀이|이어서/i.test(
      q,
    );
  if (dating && after) {
    return [`${region} 와인바`, `${region} 바`, `${region} 이자카야`];
  }
  return [];
}

/**
 * 통합 검색 백업 복구 시 — 추출 지역과 주소·상호 불일치이거나 지도 기준점에서 너무 먼 후보 제외.
 * @returns {{ kept: any[], checks: { name: string, address: string, distanceKm: number|null, regionMatched: boolean, kept: boolean }[] }}
 */
export function filterPlacesForUnifiedMapBackupRestore(
  places,
  { sortOrigin = null, locationName = "", maxDistanceKm = 12 } = {},
) {
  const ln = String(locationName || "").trim();
  const checks = [];
  const kept = [];
  for (const p of places || []) {
    const lat = parseFloat(p.y ?? p.lat);
    const lng = parseFloat(p.x ?? p.lng);
    let distanceKm = null;
    if (
      sortOrigin &&
      Number.isFinite(sortOrigin.lat) &&
      Number.isFinite(sortOrigin.lng) &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      distanceKm = haversineKm(sortOrigin.lat, sortOrigin.lng, lat, lng);
    }
    const regionMatched = placeMatchesMapRegionAnchor(p, ln);
    const distOk =
      distanceKm == null || !Number.isFinite(distanceKm)
        ? true
        : distanceKm <= maxDistanceKm;
    const anchorOk = !ln || regionMatched;
    const ok = anchorOk && distOk;
    checks.push({
      name: String(p.place_name || p.name || ""),
      address: String(p.address_name || p.road_address_name || ""),
      distanceKm,
      regionMatched,
      kept: ok,
    });
    if (ok) kept.push(p);
  }
  return { kept, checks };
}

/** 이름·카테고리 기준 해산물 후보(단독 `회`·`회식` 오탐 방지) */
const SEAFOOD_POSITIVE_RE =
  /해산물|횟집|회집|횟강|생선회|모둠회|물회|회덮밥|생선|해물|해물탕|조개|조개구이|굴|전복|대게|킹크랩|랍스터|사시미|오마카세|스시|초밥|참치|연어|광어|우럭|아구찜|아구탕|낙지|오징어|문어|새우|게장|해천탕|회전초밥|일식음식점|수산|활어|해삼|키조개|전어|병어|도미|참돔|방어|연포탕|해물찜|조개전골/i;

/** 해산물 의도와 어긋나는 업종(치킨·족발 등) */
const SEAFOOD_NEGATIVE_RE =
  /치킨|chicken|통닭|후라이드|순살|양념치킨|간장치킨|닭강정|닭발|닭똥|bbq|족발|보쌈|삼겹살|돼지갈비|소갈비|갈비\s*전문|뼈해장|순대국|피자|파스타|버거|햄버거|마라탕|훠궈|짜장|짬뽕|중국요리|떡볶이|쌀국수|브런치|베이커리|빵\s*전문|스테이크\s*하우스/i;

/**
 * 원문·파싱 결과 기준으로 «해산물 쪽만» 보여줄지.
 * (지도/근처 검색 공통 — `filterPlacesByParsedIntent`에서 사용)
 */
/** 상호·카테고리에 야외·노천 힌트 (랭킹·후보 축소 공통) */
export const YAJANG_PLACE_HINT_RE =
  /야장|노천|포장마차|포차|테라스|야외|루프탑|옥상|가로수|길가|실외|마당|노상|이동식/i;

export function queryWantsYajangFocus(rawQuery, parsedResult) {
  const q = String(rawQuery || "").toLowerCase();
  if (
    /야장|야장술집|노천주점|노천\s*술|야외\s*술|야외술집|야외\s*테라스|테라스\s*술집/i.test(
      q
    )
  ) {
    return true;
  }
  const p = parsedResult || {};
  const vibes = p.vibes?.length ? p.vibes : [p.vibe].filter(Boolean);
  return vibes.includes("야장");
}

/** 큐레이터 `tags`·`vibes`에 야외·야장류가 있는지 (DB 병합 카드 기준) */
const YAJANG_CURATOR_META_RE =
  /야장|야외|테라스|루프탑|노천|옥상|포장마차|포차|가로수|노상|이동식|마당|실외/i;

export function placeSignalsYajangCuratorMeta(place) {
  if (!place || typeof place !== "object") return false;
  const hit = (arr) =>
    Array.isArray(arr) &&
    arr.some(
      (x) => typeof x === "string" && x.trim() && YAJANG_CURATOR_META_RE.test(x)
    );
  return hit(place.tags) || hit(place.vibes) || hit(place.moods);
}

/** 큐레이터 태그·한줄평·방문상황 등에 «낮술»류가 있는지 */
const DAY_DRINK_CURATOR_META_RE =
  /낮술|낮\s*술|점심\s*술|브런치\s*술|런치\s*와인|한낮\s*한잔|점심술|브런치술/i;

function collectDayDrinkCuratorText(place) {
  if (!place || typeof place !== "object") return "";
  const parts = [];
  const push = (v) => {
    if (typeof v === "string" && v.trim()) parts.push(v);
  };
  push(place.menu_reason);
  push(place.recommended_menu);
  push(place.one_line_review);
  if (Array.isArray(place.visit_situations)) {
    for (const v of place.visit_situations) push(String(v));
  }
  const arrHit = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) push(String(x));
  };
  arrHit(place.tags);
  arrHit(place.vibes);
  arrHit(place.moods);
  if (Array.isArray(place.curatorPlaces)) {
    for (const cp of place.curatorPlaces) {
      push(cp?.menu_reason);
      push(cp?.one_line_review);
      arrHit(cp?.tags);
    }
  }
  return parts.join(" ");
}

export function placeSignalsDayDrinkCuratorMeta(place) {
  if (!place || typeof place !== "object") return false;
  const hit = (arr) =>
    Array.isArray(arr) &&
    arr.some(
      (x) => typeof x === "string" && x.trim() && DAY_DRINK_CURATOR_META_RE.test(x)
    );
  if (hit(place.tags) || hit(place.vibes) || hit(place.moods)) return true;
  return DAY_DRINK_CURATOR_META_RE.test(collectDayDrinkCuratorText(place));
}

/** 검색어에 낮술·점심 술 의도 */
export function queryWantsDayDrinkFocus(rawQuery) {
  const q = String(rawQuery || "");
  return /낮술|낮\s*술|점심술|브런치술|한낮|낮에\s*한잔|점심에\s*한잔|오전\s*술/i.test(
    q
  );
}

export function filterPlacesByYajangFocus(
  places,
  rawQuery,
  parsedResult,
  curatorCatalog = null
) {
  if (!queryWantsYajangFocus(rawQuery, parsedResult)) {
    return Array.isArray(places) ? places : [];
  }
  const list = Array.isArray(places) ? places : [];
  const cat =
    Array.isArray(curatorCatalog) && curatorCatalog.length ? curatorCatalog : null;

  const narrowed = list.filter((pl) => {
    if (YAJANG_PLACE_HINT_RE.test(placeHaystack(pl))) return true;
    if (cat) {
      const m = findCuratorCatalogMatch(pl, cat);
      if (m && placeSignalsYajangCuratorMeta(m)) return true;
    }
    return false;
  });
  return narrowed.length > 0 ? narrowed : list;
}

export function queryWantsSeafoodFocus(rawQuery, parsedResult) {
  const q = String(rawQuery || "").toLowerCase();
  const p = parsedResult || {};
  const foods = p.foods?.length ? p.foods : [p.food].filter(Boolean);
  if (foods.includes("해산물")) return true;
  if (q.includes("해산물")) return true;
  if (
    /횟집|회집|생선회|해물탕|조개구이|사시미|오마카세|수산시장|활어회/.test(q)
  ) {
    return true;
  }
  return false;
}

/**
 * 해산물 의도일 때 카카오 후보를 업종에 맞게 좁힘. 0건이어도 닭·치킨으로 채우지 않음.
 */
export function filterPlacesBySeafoodFocus(places, rawQuery, parsedResult) {
  if (!queryWantsSeafoodFocus(rawQuery, parsedResult)) {
    return Array.isArray(places) ? places : [];
  }
  const list = Array.isArray(places) ? places : [];
  return list.filter((pl) => {
    const t = placeHaystack(pl);
    if (SEAFOOD_NEGATIVE_RE.test(t)) return false;
    return SEAFOOD_POSITIVE_RE.test(t);
  });
}

/** 랭킹 보정용 — 해산물 검색인데 치킨·족발류가 섞였을 때 */
export function isObviousNonSeafoodKakaoPlace(place) {
  return SEAFOOD_NEGATIVE_RE.test(placeHaystack(place));
}

/**
 * 원문 쿼리 기준 — 카카오 키워드 뒤에 붙는 토큰(2차·힙·단체 등).
 * 지역+술집만 같을 때 검색 풀이 완전히 동일해지는 것을 줄인다.
 */
export function getKakaoKeywordSuffix(rawQuery) {
  const q = String(rawQuery || "").trim();
  if (!q) return "";
  const parts = [];
  const add = (t) => {
    if (t && !parts.includes(t)) parts.push(t);
  };

  if (/2차|이차|둘째잔|뒷풀이/i.test(q)) add("2차");
  if (/힙한|힙\s|힙$|트렌디|trendy|유행|\bcool\b/i.test(q)) add("힙");
  else if (/감성|인스타|예쁜|아기자기/i.test(q)) add("감성");
  if (/조용|차분|한적/i.test(q)) add("조용");
  if (/루프탑|rooftop/i.test(q)) add("루프탑");
  /** 야장 의도 — barKeywords가 «술집»만 잡아도 카카오 쿼리에 야장이 붙도록 */
  if (
    /야장|야장술집|노천주점|노천\s*술|야외\s*술|야외술집|야외\s*테라스|테라스\s*술집/i.test(
      q
    )
  ) {
    add("야장");
  }
  /** 이미 «와인바» «칵테일바»면 접미 «바» 생략 — «을지로 와인바 바» 중복 방지 */
  if (!/와인바|칵테일바|칵테일\s*바/i.test(q)) {
    if (/와인|칵테일|펍(?!\w)/i.test(q)) add("바");
  }

  const party = parsePartySize(q);
  if (party != null && party >= 4) add("단체");

  for (const [tag, kws] of Object.entries(SEARCH_TAG_KEYWORDS)) {
    if (kws.some((kw) => q.includes(kw))) {
      if (tag === "가성비" || tag === "늦게까지" || tag === "안주맛집") add(tag);
    }
  }

  return parts.join(" ").trim();
}

// 메인 파서 함수
/** 스칼라 필드(region 등)는 첫 매칭(사전 순서) — 배열 필드는 쿼리에 걸린 축 전부 */
export function parseSearchQuery(query) {
  const lowerQuery = query.toLowerCase().trim();

  const regions = [];
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      regions.push(region);
    }
  }

  const alcohols = [];
  for (const [alcohol, keywords] of Object.entries(ALCOHOL_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      alcohols.push(alcohol);
    }
  }

  const situations = [];
  for (const [situation, keywords] of Object.entries(SITUATION_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      situations.push(situation);
    }
  }

  const vibes = [];
  for (const [vibe, keywords] of Object.entries(VIBE_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      vibes.push(vibe);
    }
  }

  const foods = [];
  for (const [food, keywords] of Object.entries(FOOD_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      foods.push(food);
    }
  }

  const tags = [];
  for (const [tag, keywords] of Object.entries(SEARCH_TAG_KEYWORDS)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }

  let matchCount = 0;
  if (regions.length) matchCount++;
  if (alcohols.length) matchCount++;
  if (situations.length) matchCount++;
  if (vibes.length) matchCount++;
  if (foods.length) matchCount++;
  matchCount += tags.length;

  const result = {
    region: regions[0] ?? null,
    alcohol: alcohols[0] ?? null,
    situation: situations[0] ?? null,
    vibe: vibes[0] ?? null,
    food: foods[0] ?? null,
    regions,
    alcohols,
    situations,
    vibes,
    foods,
    tags,
    partySize: parsePartySize(query),
    keywords: uniqStrings([
      ...regions,
      ...alcohols,
      ...situations,
      ...vibes,
      ...foods,
      ...tags,
    ]),
    confidence: Math.min(1, matchCount / 6),
  };

  return result;
}

/**
 * LLM 힌트로 키워드를 바꾸면 안 되는 경우(와인바·칵테일바 등 구체 업종).
 * `parsed`는 `parseSearchQuery` 결과.
 */
export function lockKeywordToClientForKakaoHint(rawQuery, parsed) {
  const q = String(rawQuery || "");
  if (
    /와인바|와인\s*바|칵테일바|칵테일\s*바|위스키바|다이닝바|와인\s*룸|와인\s*펍/i.test(
      q
    )
  ) {
    return true;
  }
  if (/이자카야|라운지\s*바|루프탑\s*바|펍\s|펍$/i.test(q)) return true;
  const alcohols = parsed?.alcohols?.length
    ? parsed.alcohols
    : [parsed?.alcohol].filter(Boolean);
  if (
    alcohols.includes("와인") &&
    /바|펍|lounge|라운지|와인|wine|칵테일/i.test(q)
  ) {
    return true;
  }
  if (alcohols.includes("사케") || alcohols.includes("양주")) return true;
  return false;
}

function placeHaystack(place) {
  return `${place?.category_name || ""} ${place?.place_name || ""}`.toLowerCase();
}

/**
 * 쿼리에 지역이 있으면 그 지역(동의어)이 주소·상호·카테고리에 보이는 장소만 통과.
 * 예: "성수 … 와인바"인데 압구정만 나오는 혼선 방지. 0건이면 필터 생략.
 *
 * @param {string} [rawQuery] 원문 — 홍대 클러스터 하위 동명(합정 등)이 있으면 그 범위로만 한정
 */
export function placeMatchesAnyParsedRegion(place, parsedRegions, rawQuery) {
  if (!Array.isArray(parsedRegions) || parsedRegions.length === 0) return true;
  const profile = buildPlaceScoringProfile(place);
  const hay = `${profile.addressLower} ${profile.textLower}`;
  const q = String(rawQuery || "").toLowerCase();
  const hongdaeStrictLiterals = HONGDAE_QUERY_STRICT_SUBTOKENS.filter((t) =>
    q.includes(t.toLowerCase()),
  );
  for (const r of parsedRegions) {
    if (!r) continue;
    const syns = REGION_KEYWORDS[r];
    if (!syns?.length) continue;
    /**
     * `inferRegionKeyFromAddress`가 망원·상수도 `홍대` 키로 묶을 수 있어,
     * `profile.region === 홍대`를 먼저 쓰면 쿼리가「합정」일 때도 망원이 통과한다.
     */
    if (r === "홍대" && hongdaeStrictLiterals.length > 0) {
      if (
        hongdaeStrictLiterals.some((lit) =>
          hay.includes(String(lit || "").toLowerCase()),
        )
      ) {
        return true;
      }
      continue;
    }
    if (profile.region === r) return true;
    if (
      syns.some((syn) => hay.includes(String(syn || "").toLowerCase()))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 파싱된 주종·쿼리와 카테고리가 어긋난 카카오 후보 제거.
 * 걸러낸 뒤 0건이면 원본을 돌려준다.
 */
/**
 * @param {{ curatorCatalogForYajang?: object[] }} [options] 야장 의도 시 카카오 상호에 안 나와도 큐레이터 태그로 후보 유지
 */
export function filterPlacesByParsedIntent(
  places,
  parsedResult,
  rawQuery,
  options = {}
) {
  const list = Array.isArray(places) ? places : [];
  if (list.length === 0) return list;

  const q = String(rawQuery || "").toLowerCase();
  const p = parsedResult || {};
  const parsedRegions =
    p.regions?.length > 0
      ? p.regions
      : p.region
        ? [p.region]
        : [];
  let geoScoped = list;
  if (parsedRegions.length) {
    const regionPass = list.filter((pl) =>
      placeMatchesAnyParsedRegion(pl, parsedRegions, rawQuery),
    );
    /**
     * 주소에 지역명이 안 찍혀도 같은 동네 POI가 많다.
     * 엄격 지역 필터는 통과 건수가 충분할 때만 쓴다.
     * 예전 `(regionPass ≥ 1 && list ≤ 6)`는 후보가 적을 때 1곳만 통과(상호에만 지명이 있는
     * 「을지로 골목집」 등)하면 나머지를 전부 버려 단일 결과처럼 보이는 버그였다.
     */
    const strictRegionEnough = regionPass.length >= 4;
    const smallPoolMostlyInRegion =
      list.length > 0 &&
      list.length <= 10 &&
      regionPass.length >= 2 &&
      regionPass.length >= Math.ceil(list.length * 0.4);
    const hongdaeSubPinned =
      parsedRegions.includes("홍대") && queryPinsHongdaeStrictSubtoken(rawQuery);
    if (
      strictRegionEnough ||
      smallPoolMostlyInRegion ||
      (hongdaeSubPinned && regionPass.length > 0)
    ) {
      geoScoped = regionPass;
    } else if (hongdaeSubPinned && regionPass.length === 0) {
      geoScoped = [];
    }
  }
  const alcohols = p.alcohols?.length
    ? p.alcohols
    : [p.alcohol].filter(Boolean);

  const wantsPocha =
    q.includes("포차") ||
    q.includes("포장마차") ||
    alcohols.includes("막걸리");

  const wantsWineBar =
    q.includes("와인바") ||
    q.includes("와인 바") ||
    (q.includes("와인") &&
      /바|펍|lounge|라운지|칵테일|와인바|wine/i.test(q)) ||
    (alcohols.includes("와인") &&
      /바|펍|lounge|와인|wine|칵테일/i.test(q));

  const wantsCocktailOnly =
    /칵테일바|칵테일\s*바/i.test(q) ||
    (alcohols.includes("하이볼") && /칵테일|바/i.test(q));

  const mismatchCheapNight = (t) => {
    if (/통닭|치킨|후라이드|순살|닭똥|닭발|족발|보쌈|뼈\s*해장|국밥\s*집/i.test(t)) {
      return true;
    }
    if (!wantsPocha && /포장마차|실내포장|포차/.test(t)) {
      return true;
    }
    return false;
  };

  const matchesRefinedBar = (t) =>
    /와인|wine|칵테일|cocktail|와인바|다이닝|펍|pub|라운지|lounge|바\s|바\)|>\s*바|음식점\s*>\s*바|w\s*bar|vin|vino|셀러|cellar/i.test(
      t
    );

  let filtered = geoScoped;

  if (wantsWineBar || wantsCocktailOnly) {
    /** "2차 술집 or 와인바"처럼 술집·바 업종을 같이 염두에 둔 경우 — 와인만 남기면 후보가 너무 줄어듦 */
    const barOrWineMix =
      /\s(or|또는)\s|\|/.test(q) ||
      (wantsWineBar &&
        !wantsCocktailOnly &&
        /(?:2차|이차|술집|뒷풀이|호프|주점)/i.test(q));

    filtered = geoScoped.filter((pl) => {
      const t = placeHaystack(pl);
      if (mismatchCheapNight(t)) return false;

      if (barOrWineMix && wantsWineBar && !wantsCocktailOnly) {
        if (
          /호프$|호프\s|맥주\s*전문|생맥/i.test(t) &&
          !/와인|wine|바|펍/i.test(t)
        ) {
          return false;
        }
        return (
          matchesRefinedBar(t) ||
          /주점|술집|이자카야|호프|요리주점|포차|포장마차|펍/i.test(t)
        );
      }

      if (wantsWineBar && !wantsCocktailOnly) {
        if (/호프$|호프\s|맥주\s*전문|생맥/i.test(t) && !/와인|wine|바|펍/i.test(t)) {
          return false;
        }
      }
      return matchesRefinedBar(t);
    });
  } else if (
    alcohols.includes("와인") ||
    alcohols.includes("양주") ||
    alcohols.includes("사케")
  ) {
    filtered = geoScoped.filter((pl) => {
      const t = placeHaystack(pl);
      if (mismatchCheapNight(t)) return false;
      return (
        matchesRefinedBar(t) ||
        /이자카야|일본\s*주점|사케|sake|위스키|whisky|양주/i.test(t)
      );
    });
  }

  if (queryWantsSeafoodFocus(rawQuery, p)) {
    return filterPlacesBySeafoodFocus(filtered, rawQuery, p);
  }

  if (queryWantsYajangFocus(rawQuery, p)) {
    filtered = filterPlacesByYajangFocus(
      filtered,
      rawQuery,
      p,
      options.curatorCatalogForYajang ?? null
    );
  }

  if (filtered.length > 0) return filtered;

  const appliedStrictAlcoholPlaceFilter =
    wantsWineBar ||
    wantsCocktailOnly ||
    alcohols.includes("와인") ||
    alcohols.includes("양주") ||
    alcohols.includes("사케");

  /**
   * 와인바·칵테일 등으로 좁혔는데 한 건도 안 남으면, 아래에서 `geoScoped`/`list`로
   * 되돌리면 학교·사무실 등 무관 POI가 다시 끼어든다(예: 을지로 와인바 검색).
   */
  if (appliedStrictAlcoholPlaceFilter) {
    return [];
  }

  if (geoScoped.length > 0 && geoScoped.length < list.length) return geoScoped;
  return list;
}

// 필터 칩 생성 함수
export function createFilterChips(parsedResult) {
  const chips = [];

  const regionList =
    parsedResult.regions?.length > 0
      ? parsedResult.regions
      : parsedResult.region
        ? [parsedResult.region]
        : [];
  for (const label of regionList) {
    chips.push({
      type: "region",
      icon: "📍",
      label,
      color: "#3498db",
    });
  }

  const alcoholList =
    parsedResult.alcohols?.length > 0
      ? parsedResult.alcohols
      : parsedResult.alcohol
        ? [parsedResult.alcohol]
        : [];
  for (const label of alcoholList) {
    chips.push({
      type: "alcohol",
      icon: "🍷",
      label,
      color: "#e74c3c",
    });
  }

  const situationList =
    parsedResult.situations?.length > 0
      ? parsedResult.situations
      : parsedResult.situation
        ? [parsedResult.situation]
        : [];
  for (const label of situationList) {
    chips.push({
      type: "situation",
      icon: "🎉",
      label,
      color: "#f39c12",
    });
  }

  const vibeList =
    parsedResult.vibes?.length > 0
      ? parsedResult.vibes
      : parsedResult.vibe
        ? [parsedResult.vibe]
        : [];
  for (const label of vibeList) {
    chips.push({
      type: "vibe",
      icon: "✨",
      label,
      color: "#9b59b6",
    });
  }

  const foodList =
    parsedResult.foods?.length > 0
      ? parsedResult.foods
      : parsedResult.food
        ? [parsedResult.food]
        : [];
  for (const label of foodList) {
    chips.push({
      type: "food",
      icon: "🍽️",
      label,
      color: "#2ecc71",
    });
  }

  for (const tag of parsedResult.tags || []) {
    chips.push({
      type: "tag",
      icon: "🏷️",
      label: tag,
      color: "#16a085",
    });
  }

  return chips;
}

// 검색 요약 생성
export function createSearchSummary(parsedResult, originalQuery) {
  const matchedFilters = createFilterChips(parsedResult);

  if (matchedFilters.length === 0) {
    return `"${originalQuery}" 검색 결과`;
  }

  const filterLabels = matchedFilters.map((chip) => chip.label).join(" + ");
  return `${filterLabels} 검색 결과`;
}

/** `parseSearchQuery` 결과 → 멀티 매칭용 배열 (실체는 가중치 랭킹, UI에는 자연스러운 이유 문구용). */
export function normalizeParsedForScoring(parsedResult) {
  const p = parsedResult || {};
  const regions = p.regions?.length ? p.regions : [p.region].filter(Boolean);
  const alcohols = p.alcohols?.length ? p.alcohols : [p.alcohol].filter(Boolean);
  const vibes = p.vibes?.length ? p.vibes : [p.vibe].filter(Boolean);
  const purposes = p.situations?.length
    ? p.situations
    : [p.situation].filter(Boolean);
  const foods = p.foods?.length ? p.foods : [p.food].filter(Boolean);
  return {
    regions,
    alcohols,
    vibes,
    purposes,
    foods,
    tags: [...(p.tags || [])],
  };
}

function facetsFromHaystack(textLower, dict) {
  if (!textLower || !dict) return [];
  const found = [];
  for (const [canonical, syns] of Object.entries(dict)) {
    if (!canonical || !syns?.length) continue;
    if (syns.some((s) => textLower.includes(String(s).toLowerCase()))) {
      found.push(canonical);
    }
  }
  return uniqStrings(found);
}

function inferRegionKeyFromAddress(addressLower) {
  if (!addressLower) return null;
  for (const regionKey of Object.keys(REGION_KEYWORDS)) {
    const syns = REGION_KEYWORDS[regionKey];
    if (syns.some((kw) => addressLower.includes(String(kw).toLowerCase()))) {
      return regionKey;
    }
  }
  return null;
}

/**
 * DB 정규화 필드 + 카카오 텍스트(이름·카테고리·주소)에서 면 추출.
 * `parsed.*` 배열과 교집합할 때 쓴다.
 */
export function buildPlaceScoringProfile(place) {
  const addressLower = `${place?.address_name || ""} ${place?.road_address_name || ""} ${place?.address || ""}`.toLowerCase();
  const textLower = `${place?.place_name || place?.name || ""} ${place?.category_name || place?.category || ""} ${addressLower}`.toLowerCase();

  const region =
    place?.region ||
    inferRegionKeyFromAddress(addressLower) ||
    null;

  const mergeFacet = (explicit, dict) =>
    uniqStrings([...(Array.isArray(explicit) ? explicit : []), ...facetsFromHaystack(textLower, dict)]);

  return {
    region,
    addressLower,
    textLower,
    alcohol_types: mergeFacet(place?.alcohol_types, ALCOHOL_KEYWORDS),
    vibes: mergeFacet(place?.vibes, VIBE_KEYWORDS),
    purposes: mergeFacet(place?.purposes, SITUATION_KEYWORDS),
    food_types: mergeFacet(place?.food_types, FOOD_KEYWORDS),
    tags: mergeFacet(place?.tags, SEARCH_TAG_KEYWORDS),
    curator_count: place?.curator_count ?? place?.curatorCount ?? 0,
    bookmarked_count: place?.bookmarked_count ?? place?.saved_count ?? 0,
    follower_sum: place?.follower_sum ?? place?.followers_count ?? 0,
  };
}

/**
 * 검색어에서 뽑은 축 중 이 장소에 실제로 맞은 정규 라벨(칩 UI).
 * 순서: 지역 → 주종 → 상황 → 분위기 → 음식 → 태그.
 */
export function matchedQueryFacetLabels(place, parsedResult) {
  const parsed = normalizeParsedForScoring(parsedResult);
  const profile = buildPlaceScoringProfile(place);
  const labels = [];

  for (const r of parsed.regions) {
    if (profile.region === r) labels.push(r);
    else if (
      REGION_KEYWORDS[r]?.some((syn) =>
        profile.addressLower.includes(String(syn).toLowerCase())
      )
    ) {
      labels.push(r);
    }
  }
  for (const a of parsed.alcohols) {
    if (profile.alcohol_types.includes(a)) labels.push(a);
  }
  for (const s of parsed.purposes) {
    if (profile.purposes.includes(s)) labels.push(s);
  }
  for (const v of parsed.vibes) {
    if (profile.vibes.includes(v)) labels.push(v);
  }
  for (const f of parsed.foods) {
    if (profile.food_types.includes(f)) labels.push(f);
  }
  for (const t of parsed.tags) {
    if (profile.tags.includes(t)) labels.push(t);
  }

  return uniqStrings(labels);
}

/**
 * 카드·시트용 "왜 추천했는지" 짧은 근거 목록 (룰 기반이라 AI 아님).
 * @returns {string[]}
 */
export function buildRecommendationWhyLabels(place, parsedResult) {
  const parsed = normalizeParsedForScoring(parsedResult);
  const profile = buildPlaceScoringProfile(place);
  const out = [];

  for (const r of parsed.regions) {
    if (profile.region === r) {
      out.push(r);
      break;
    }
    if (
      REGION_KEYWORDS[r]?.some((syn) =>
        profile.addressLower.includes(String(syn).toLowerCase())
      )
    ) {
      out.push(r);
      break;
    }
  }

  for (const a of parsed.alcohols) {
    if (profile.alcohol_types.includes(a)) {
      out.push(`${a}`);
      break;
    }
  }

  for (const v of parsed.vibes) {
    if (profile.vibes.includes(v)) {
      out.push(`${v} 분위기`);
      break;
    }
  }

  for (const s of parsed.purposes) {
    if (profile.purposes.includes(s)) {
      out.push(s === "2차" ? "2차" : `${s} 맥락`);
      break;
    }
  }

  for (const f of parsed.foods) {
    if (profile.food_types.includes(f)) {
      out.push(`${f}`);
      break;
    }
  }

  const tagHit = parsed.tags.find((t) => profile.tags.includes(t));
  if (tagHit) out.push(`${tagHit} 태그`);

  const c = profile.curator_count;
  if (c >= 3) out.push(`큐레이터 ${c}명 저장`);
  else if (c === 2) out.push("큐레이터 2명 추천");

  return uniqStrings(out);
}

/**
 * 결과 카드 한 줄 — 지역·검색어 반복 없이 짧게(가게명·검색어는 UI 상단에 이미 있음).
 */
export function buildRecommendationWhyLine(place, parsedResult) {
  const parsed = normalizeParsedForScoring(parsedResult);
  const profile = buildPlaceScoringProfile(place);

  let regionHit = null;
  for (const r of parsed.regions) {
    if (profile.region === r) {
      regionHit = r;
      break;
    }
    if (
      REGION_KEYWORDS[r]?.some((syn) =>
        profile.addressLower.includes(String(syn).toLowerCase())
      )
    ) {
      regionHit = r;
      break;
    }
  }

  const alcHit =
    parsed.alcohols.find((a) => profile.alcohol_types.includes(a)) || null;
  const vibeHit =
    parsed.vibes.find((v) => profile.vibes.includes(v)) || null;
  const purposeHit =
    parsed.purposes.find((p) => profile.purposes.includes(p)) || null;
  const foodHit =
    parsed.foods.find((f) => profile.food_types.includes(f)) || null;
  const tagHit = parsed.tags.find((t) => profile.tags.includes(t)) || null;

  const c = profile.curator_count;
  const chunks = [];

  /** 한 줄 이유: 검색 지역·키워드 반복 없이(가게명·검색어는 카드 상단에 이미 있음) */
  if (regionHit && alcHit) {
    chunks.push(`${alcHit}에 맞는 업종·태그예요`);
  } else if (regionHit && vibeHit) {
    chunks.push(`${vibeHit} 분위기 태그가 잘 맞아 보여요`);
  } else if (regionHit && purposeHit === "2차") {
    chunks.push(`2차로 쓰기 좋아 보여요`);
  } else if (regionHit) {
    chunks.push(`업종·태그가 자연스러워 보여요`);
  }

  if (!chunks.length && alcHit) {
    chunks.push(`${alcHit}에 맞는 업종으로 보여요`);
  }
  if (!chunks.length && vibeHit) {
    chunks.push(`${vibeHit}한 분위기 태그가 많이 붙어 있어 보여요`);
  }
  if (!chunks.length && purposeHit === "2차") {
    chunks.push(`2차로 저장·추천되는 비율이 높은 후보예요`);
  } else if (!chunks.length && purposeHit) {
    chunks.push(`${purposeHit}에 어울려 보여요`);
  }
  if (!chunks.length && foodHit) {
    chunks.push(`${foodHit} 메뉴가 눈에 띄어요`);
  }
  if (!chunks.length && tagHit) {
    chunks.push(`「${tagHit}」 태그가 잘 맞아요`);
  }

  if (c >= 3) {
    chunks.push(`${c}명의 큐레이터가 저장했어요`);
  } else if (c === 2) {
    chunks.push(`큐레이터 2명이 이 장소를 추천했어요`);
  }

  const uniq = [];
  const seen = new Set();
  for (const ch of chunks) {
    if (!ch || seen.has(ch)) continue;
    seen.add(ch);
    uniq.push(ch);
  }

  return uniq.slice(0, 2).join(" · ");
}

/** 카테고리 마지막 구간 또는 태그·분위기 한 줄 */
export function representativePlaceTag(place) {
  const cat = String(place?.category_name || place?.category || "").trim();
  if (cat.includes(">")) {
    const parts = cat.split(">").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.length > 12 ? `${last.slice(0, 12)}…` : last;
  }
  const tags = place?.tags;
  if (Array.isArray(tags) && tags[0]) return String(tags[0]);
  const atm = place?.atmosphere;
  if (atm && atm !== "일반적인") return String(atm);
  if (cat) return cat.length > 14 ? `${cat.slice(0, 14)}…` : cat;
  return "술집·식당";
}

const BARISH_RE = /주점|술집|이자카야|호프|포장마차|펍|음식점\s*>\s*바|와인|칵테일|바(?![a-z])/i;

/**
 * 검색 파싱 결과와 장소 프로필 교집합 + 소셜 가산. (LLM 아님 — 투명한 가중치 랭킹)
 * `parsedResult`: `parseSearchQuery` 반환 형태.
 * @returns {{ score: number, reasons: string[], matchReasons: string[] }}
 */
export function scorePlace(place, parsedResult) {
  const parsed = normalizeParsedForScoring(parsedResult);
  const profile = buildPlaceScoringProfile(place);
  let score = 0;
  const reasons = [];

  if (parsed.regions.length) {
    let hit = false;
    if (profile.region && parsed.regions.includes(profile.region)) {
      hit = true;
      reasons.push(`${profile.region} 일치`);
    } else {
      for (const r of parsed.regions) {
        if (REGION_KEYWORDS[r]?.some((syn) => profile.addressLower.includes(String(syn).toLowerCase()))) {
          hit = true;
          reasons.push(`${r} 지역`);
          break;
        }
      }
    }
    if (hit) score += 5;
  }

  const alcoholMatchCount = parsed.alcohols.filter((a) =>
    profile.alcohol_types.includes(a)
  ).length;
  if (alcoholMatchCount) {
    score += alcoholMatchCount * 5;
    parsed.alcohols.forEach((a) => {
      if (profile.alcohol_types.includes(a)) reasons.push(`${a} 일치`);
    });
  } else if (parsed.alcohols.length && BARISH_RE.test(profile.textLower)) {
    score += 2;
    reasons.push(`${parsed.alcohols[0]} 후보(업종)`);
  }

  const vibeMatchCount = parsed.vibes.filter((v) => profile.vibes.includes(v)).length;
  if (vibeMatchCount) {
    score += vibeMatchCount * 4;
    parsed.vibes.forEach((v) => {
      if (profile.vibes.includes(v)) reasons.push(`${v} 분위기`);
    });
  }

  const purposeMatchCount = parsed.purposes.filter((p) =>
    profile.purposes.includes(p)
  ).length;
  if (purposeMatchCount) {
    score += purposeMatchCount * 4;
    parsed.purposes.forEach((p) => {
      if (profile.purposes.includes(p)) reasons.push(`${p} 일치`);
    });
  } else if (parsed.purposes.includes("2차") && BARISH_RE.test(profile.textLower)) {
    score += 3;
    reasons.push("2차 후보(업종)");
  }

  const foodMatchCount = parsed.foods.filter((f) => profile.food_types.includes(f)).length;
  if (foodMatchCount) {
    score += foodMatchCount * 4;
    parsed.foods.forEach((f) => {
      if (profile.food_types.includes(f)) reasons.push(`${f} 메뉴`);
    });
  }

  const tagMatchCount = parsed.tags.filter((t) => profile.tags.includes(t)).length;
  if (tagMatchCount) {
    score += tagMatchCount * 3;
    parsed.tags.forEach((t) => {
      if (profile.tags.includes(t)) reasons.push(`${t}`);
    });
  }

  const c = profile.curator_count;
  if (c >= 3) {
    score += 4;
    reasons.push("큐레이터 3명 이상");
  } else if (c >= 2) {
    score += 2;
    reasons.push("큐레이터 2명↑");
  }

  const bm = profile.bookmarked_count || 0;
  const bmAdd = Math.min(bm * 0.05, 3);
  score += bmAdd;
  if (bmAdd >= 1) reasons.push("저장·관심 가산");

  score += Math.min((profile.follower_sum || 0) * 0.002, 3);

  return {
    score,
    reasons,
    matchReasons: reasons,
  };
}

// 인기 검색 예시
export const SEARCH_EXAMPLES = [
  { query: "성수 2차 하이볼", icon: "🍹" },
  { query: "을지로 조용한 소주집", icon: "🥃" },
  { query: "강남 데이트 와인", icon: "🍷" },
  { query: "해산물에 술 좋은 곳", icon: "🦐" },
  { query: "홍대 락바 혼술", icon: "🎸" },
  { query: "종로 전통주 모임", icon: "🍶" },
];
