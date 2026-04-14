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
    성수: ["성수", "성수역", "성수동", "서울숲", "뚝섬"],
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

function buildAlcoholKeywords() {
  const LEGACY = {
    소주: ["소주", "새로", "참이슬", "시원", "한잔"],
    맥주: ["맥주", "생맥", "수제맥", "크래프트", "draft", "페일에일", "IPA"],
    와인: ["와인", "레드와인", "화이트와인", "wine", "잔", "보르도", "부르고뉴"],
    하이볼: ["하이볼", "칵테일", "진토닉", "모히토", "맥주콜라", "위스키"],
    양주: ["양주", "위스키", "진", "보드카", "럼", "테킬라"],
    사케: ["사케", "청주", "일본술"],
    막걸리: ["막걸리", "탁주", "생막걸리", "전주"],
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
  return [...out].slice(0, 10);
}

/**
 * 역·동·구 등이 있으면 카카오 keywordSearch에 bounds를 넣지 않는다.
 * (지도 뷰가 다른 동네일 때 API가 빈 결과를 주는 문제 방지)
 */
export function kakaoQueryHasGeographicAnchor(keyword) {
  const k = String(keyword || "");
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
  if (/와인바|칵테일바|칵테일\s*바|펍(?!\w)/i.test(q)) add("바");

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

  let filtered = list;

  if (wantsWineBar || wantsCocktailOnly) {
    /** "2차 술집 or 와인바"처럼 술집·바 업종을 같이 염두에 둔 경우 — 와인만 남기면 후보가 너무 줄어듦 */
    const barOrWineMix =
      /\s(or|또는)\s|\|/.test(q) ||
      (wantsWineBar &&
        !wantsCocktailOnly &&
        /(?:2차|이차|술집|뒷풀이|호프|주점)/i.test(q));

    filtered = list.filter((pl) => {
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
    filtered = list.filter((pl) => {
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

  return filtered.length > 0 ? filtered : list;
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
 * 결과 카드 한 줄 — 대화체로 이어 붙임 (예: "성수에 있고 하이볼 태그가 맞아 보여요 · …").
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

  if (regionHit && alcHit) {
    chunks.push(`${regionHit}에 있고 ${alcHit} 태그가 맞아 보여요`);
  } else if (regionHit && vibeHit) {
    chunks.push(
      `${regionHit}에 있고 ${vibeHit} 분위기 태그가 잘 맞아 보여요`
    );
  } else if (regionHit && purposeHit === "2차") {
    chunks.push(`${regionHit}에 있고 2차로 쓰기 좋아 보여요`);
  } else if (regionHit) {
    chunks.push(`${regionHit} 근처예요`);
  }

  if (!chunks.length && alcHit) {
    chunks.push(`검색하신 ${alcHit}에 맞는 업종으로 보여요`);
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
