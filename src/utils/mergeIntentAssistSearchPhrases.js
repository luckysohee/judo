import {
  expandFoodKakaoQueries,
  findAreaKeywordInQuery,
  REGION_KEYWORDS,
} from "./searchParser";

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
const key = (s) => norm(s).toLowerCase();

/**
 * 의도 보조 LLM이 `broadKakaoKeyword` 등을
 * "성수 바, 성수 펍, 성수 칵테일바"처럼 **한 문자열**로 줄 때 → 통합/네이버 API는 phrase별로 호출해야 함.
 */
function phrasePiecesFromRaw(raw) {
  const p = norm(raw);
  if (!p || p.length < 2) return [];
  const parts = p
    .split(/\s*[,，]\s*/u)
    .map((x) => norm(x))
    .filter((x) => x.length >= 2);
  return parts.length > 1 ? parts : [p];
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 지역 매칭 문자열 → `REGION_KEYWORDS` 캐논(없으면 매칭 문자열 그대로). */
function regionCanonFromMatched(matched) {
  if (!matched) return "";
  const low = String(matched).toLowerCase();
  for (const [canon, syns] of Object.entries(REGION_KEYWORDS)) {
    if (canon.toLowerCase() === low) return canon;
    for (const x of syns) {
      if (x.toLowerCase() === low) return canon;
    }
  }
  return String(matched);
}

/**
 * 설명·수식어 제거(긴 토큰 우선). 업종·메뉴 명사는 남기는 쪽으로만 넣음.
 */
const PHRASE_FLUFF_TOKENS = [
  "데이트하기 좋은",
  "데이트하기좋은",
  "분위기 좋은 곳",
  "분위기 좋은",
  "분위기좋은",
  "좋은 곳",
  "좋은곳",
  "맛집 추천",
  "가볼만한 곳",
  "가볼만한",
  "데이트",
  "근처",
  "주변",
  "찾기",
  "검색",
  "추천",
  "후기",
  "맛집",
  "인기",
  "핫플",
  "핫한",
  "저렴한",
  "예쁜",
  "조용한",
  "시끌벅적",
].sort((a, b) => b.length - a.length);

const OVERLY_BROAD_STEMS = new Set(
  [
    "맛집",
    "추천",
    "술집",
    "장소",
    "코스",
    "근처",
    "주변",
    "맛집 추천",
    "술집 추천",
    "데이트 코스",
    "가볼만한",
    "곳",
  ].map((x) => key(x))
);

/** `findAreaKeywordInQuery` 매칭 제거 후 fluff 제거한 업종·주제 줄기 */
function phraseStemAfterRegionAndFluff(phrase) {
  const p = norm(phrase);
  const matched = findAreaKeywordInQuery(p);
  let rest = p;
  if (matched) {
    rest = norm(rest.replace(new RegExp(escapeRegExp(matched), "gi"), " "));
  }
  let work = rest;
  for (const tok of PHRASE_FLUFF_TOKENS) {
    work = work.replace(new RegExp(escapeRegExp(tok), "gi"), " ");
  }
  return norm(work.replace(/\s+/g, " "));
}

function phraseCoreDedupeKey(phrase) {
  const p = norm(phrase);
  const matched = findAreaKeywordInQuery(p);
  const regionCanon = regionCanonFromMatched(matched);
  const stem = phraseStemAfterRegionAndFluff(phrase);
  const stemKey = key(stem);
  if (!stemKey || stemKey.length < 2) {
    return `__raw__|${key(p)}`;
  }
  return `${key(regionCanon)}|${stemKey}`;
}

function isPhraseStemTooBroad(stem) {
  const stemKey = key(stem);
  if (!stemKey || stemKey.length < 2) return true;
  if (OVERLY_BROAD_STEMS.has(stemKey)) return true;
  return false;
}

function filterMeaningfulPhrases(phrases) {
  return phrases.filter(
    (p) => !isPhraseStemTooBroad(phraseStemAfterRegionAndFluff(p))
  );
}

function dedupeByRegionCategoryCore(phrases) {
  const coreSeen = new Set();
  const out = [];
  for (const p of phrases) {
    const ck = phraseCoreDedupeKey(p);
    if (coreSeen.has(ck)) continue;
    coreSeen.add(ck);
    out.push(p);
  }
  return out;
}

/**
 * 통합 지도 검색(`/api/unified-map-search`)용 `searchPhrases` 보강.
 *
 * ### phrase가 여러 개 되는 이유 (의도된 확장 vs 버그)
 *
 * **한 줄 요약**: 서로 다른 문자열이 여러 개면 대부분 **의도된 조합**이다. 동일 문자열은
 * `push()` 안의 `seen`으로 걸러진다.
 *
 * **넣는 순서** (앞이 우선, 아래 후처리 후 `maxPhrases`에서 잘림):
 *
 * 1. `expandFoodKakaoQueries(kwUnified)` — 음식·야장 등 카카오용 쿼리 확장(복수 가능).
 * 2. `intentAssist.kakaoKeywordHint` — 의도 보조가 제안한 좁은 키워드.
 * 3. `intentAssist.broadKakaoKeyword` — 넓은 폴백 키워드.
 * 4. `regionHint + hint` / `regionHint + broad` — 지역 힌트가 있고 힌트 문자열에 지역이 안
 *    포함된 경우만 합성.
 * 5. `intentAssist.fallbackSearchIdeas` — 최대 4개(서버가 준 대체 검색 아이디어).
 *
 * ### 의미 중복 제거 (상한만 자르지 않기)
 *
 * 1. 문자열 중복: `seen` (정규화 키).
 * 2. **지역(캐논) + 업종/주제 줄기**가 같으면 하나만 유지 (`findAreaKeywordInQuery` +
 *    fluff 제거 후 비교). 예: «을지로 데이트 와인바 후기» vs «을지로 분위기 좋은 와인바 후기».
 * 3. 줄기가 **너무 포괄**한 phrase 제거(예: 지역만 빼면 «맛집»·«추천»만 남는 경우).
 * 4. `maxPhrases` 슬라이스.
 *
 * @param {string} kwUnified 카카오/통합에 쓰기로 정리된 한 줄 키워드
 * @param {Record<string, unknown> | null | undefined} intentAssist `/api/search-intent-assist` 응답
 * @param {{ maxPhrases?: number; rawQuery?: string }} [opts] 기본 10, 상한은 서버 `unified-map-search`에서도 잘림.
 *   `rawQuery`가 있으면 소개팅/데이트+2차 맥락에서 카페·브런치·식사 phrase를 뒤로 보냄.
 * @returns {string[]}
 */
export function rawQueryExplicitCafeMealCoffee(q) {
  return /카페|커피|브런치|식사|\b밥\b|한끼|점심|저녁\s*먹|밥\s*먹/i.test(String(q || ""));
}

/** 소개팅/데이트 등 + 끝나고·2차·이후·갈만한 등 후속 장소 맥락 */
export function rawQueryBlindDateSecondVenueContext(q) {
  const s = String(q || "").trim();
  if (!s) return false;
  const dating =
    /소개팅|데이트|맞선|첫\s*만남|첫만남|블라인드\s*데이트/i.test(s);
  const after =
    /끝나고|끝나서|2차|이차|이후|후\s*갈|갈만한|다음에|다음\s*에|이어서|뒷풀이/i.test(
      s
    );
  return dating && after;
}

/** 통합 phrase가 «지역 + (카페|브런치|식사)»만인 경우 — 2차 술·바 축과 섞이면 뒤로 */
function phraseIsGenericCafeBrunchMealTail(phrase) {
  const p = norm(phrase).toLowerCase();
  return /\s(카페|브런치|식사)$/.test(p);
}

export function mergeIntentAssistIntoSearchPhrases(
  kwUnified,
  intentAssist,
  opts = {}
) {
  const maxPhrases = Math.min(Math.max(Number(opts.maxPhrases) || 10, 1), 10);
  const root = norm(kwUnified);
  const base = root ? expandFoodKakaoQueries(root) : [];
  const ordered = [];
  const seen = new Set();

  const push = (raw) => {
    for (const piece of phrasePiecesFromRaw(raw)) {
      const p = norm(piece);
      if (p.length < 2) continue;
      const k = key(p);
      if (seen.has(k)) continue;
      seen.add(k);
      ordered.push(p);
    }
  };

  for (const b of base) push(b);

  const ia =
    intentAssist && typeof intentAssist === "object" ? intentAssist : null;
  if (ia) {
    const hint =
      ia.kakaoKeywordHint != null ? norm(ia.kakaoKeywordHint) : "";
    const broad =
      ia.broadKakaoKeyword != null ? norm(ia.broadKakaoKeyword) : "";

    if (hint) push(hint);
    if (broad) push(broad);

    const fh = ia.filterHints;
    const region =
      fh && typeof fh === "object" && typeof fh.regionHint === "string"
        ? norm(fh.regionHint)
        : "";
    if (region && hint && !key(hint).includes(key(region))) {
      for (const piece of phrasePiecesFromRaw(hint)) {
        push(`${region} ${piece}`.trim());
      }
    }
    if (region && broad && !key(broad).includes(key(region))) {
      for (const piece of phrasePiecesFromRaw(broad)) {
        push(`${region} ${piece}`.trim());
      }
    }

    const ideas = ia.fallbackSearchIdeas;
    if (Array.isArray(ideas)) {
      for (const idea of ideas.slice(0, 4)) {
        push(idea);
      }
    }
  }

  if (ordered.length === 0 && root) push(root);

  const meaningful = filterMeaningfulPhrases(ordered);
  const dedupedCore = dedupeByRegionCategoryCore(meaningful);

  const rq = opts.rawQuery != null ? String(opts.rawQuery) : "";
  let ranked = dedupedCore;
  if (
    rq &&
    rawQueryBlindDateSecondVenueContext(rq) &&
    !rawQueryExplicitCafeMealCoffee(rq)
  ) {
    const front = [];
    const back = [];
    for (const ph of dedupedCore) {
      if (phraseIsGenericCafeBrunchMealTail(ph)) back.push(ph);
      else front.push(ph);
    }
    ranked = [...front, ...back];
  }

  if (ranked.length > 0) {
    return ranked.slice(0, maxPhrases);
  }
  if (root) {
    return [root].slice(0, maxPhrases);
  }
  return [];
}
