/**
 * 주도 검색: 의도 축 → 점수 + 동일 근거 `signals` → 한 줄 이유(`buildReasonFromSignals`).
 */

import { normalizeHangulSearchCompounds } from "./searchParser.js";
import {
  reasonEvidenceHasBody,
  composeWhyFromEvidenceAndTail,
} from "./reasonEvidence.js";

/** 의도 축 식별자(앱·로그에서 공통 참조) */
export const INTENT = Object.freeze({
  DATE: "date",
  AFTER: "after",
  QUIET: "quiet",
  DRINK: "drink",
  CAFE: "cafe",
});

/** `buildReasonFromSignals` 기본 문구 — 매핑 없을 때·빈 signals */
export const INTENT_SIGNAL_REASON_FALLBACK = "조건에 맞는 후보로 골랐어요";

/**
 * @param {string} query
 * @returns {{ date: boolean, after: boolean, quiet: boolean, drink: boolean, cafe: boolean }}
 */
export function detectIntents(query = "") {
  const q = normalizeHangulSearchCompounds(String(query || ""))
    .toLowerCase()
    .trim();
  return {
    date: /데이트|소개팅|맞선|첫\s*만남|첫만남/.test(q),
    after: /끝나고|2\s*차|이\s*차|이후|한잔|마시러/.test(q),
    quiet: /조용|차분|대화|얘기|담소/.test(q),
    drink: /술집|바|와인|이자카야|맥주|칵테일/.test(q),
    cafe: /카페|커피|디저트/.test(q),
  };
}

/**
 * @param {object} place — 카카오 row 또는 { category_name, place_name }
 * @returns {{ winebar: boolean, bar: boolean, izakaya: boolean, cafe: boolean, italian: boolean, cheap: boolean }}
 */
export function classifyCategory(place) {
  const text = `${place?.category_name || ""} ${place?.place_name || ""}`.toLowerCase();
  return {
    winebar: /와인/.test(text),
    bar: /바|펍|칵테일/.test(text),
    izakaya: /이자카야|야키토리/.test(text),
    cafe: /카페|커피|디저트/.test(text),
    italian: /파스타|이탈리안|피자/.test(text),
    cheap: /백반|국밥|분식|해장국|기사식당/.test(text),
  };
}

/**
 * @param {Record<string, number>} signals
 * @param {(delta: number, key: string) => void} record
 */
function applyIntentRules(intent, cat, record) {
  if (intent.date) {
    if (cat.winebar) record(3, "date_winebar");
    if (cat.bar) record(2, "date_bar");
    if (cat.izakaya) record(1.5, "date_izakaya");
    if (cat.cafe) {
      if (intent.quiet) record(2, "date_quiet_cafe");
      else record(1, "date_cafe");
    }
    if (cat.italian) record(1.2, "date_italian");
    if (cat.cheap) record(-4, "penalty_date_cheap");
  }

  if (intent.after) {
    if (cat.bar) record(3, "after_bar");
    if (cat.winebar) record(2.5, "after_winebar");
    if (cat.izakaya) record(2, "after_izakaya");
    if (cat.cafe) {
      if (intent.quiet) record(1.5, "after_quiet_cafe");
      else record(0.5, "after_cafe");
    }
    if (cat.cheap) record(-3, "penalty_after_cheap");
  }

  if (intent.quiet) {
    if (cat.cafe) record(2.5, "quiet_cafe");
    if (cat.winebar) record(2, "quiet_winebar");
    if (cat.bar) record(1, "quiet_bar");
  }

  if (intent.drink && (cat.bar || cat.winebar || cat.izakaya)) {
    record(1.5, "drink_venue");
  }

  if (intent.cafe && cat.cafe) {
    record(2, "intent_cafe_match");
  }

  if (intent.date && intent.after) {
    if (cat.winebar) record(2, "combo_date_after_winebar");
    if (cat.bar) record(2, "combo_date_after_bar");
    if (cat.cafe && intent.quiet) record(1.5, "combo_date_after_quiet_cafe");
  }

  if ((intent.date || intent.after) && cat.cheap) {
    record(-5, "penalty_date_after_cheap");
  }
}

/**
 * @param {{ date: boolean, after: boolean, quiet: boolean, drink: boolean, cafe: boolean }} intent
 * @param {{ winebar: boolean, bar: boolean, izakaya: boolean, cafe: boolean, italian: boolean, cheap: boolean }} cat
 * @param {number} baseScore
 * @returns {{ score: number, signals: Record<string, number> }}
 */
export function applyIntentAxisScoresWithSignals(intent, cat, baseScore) {
  const signals = {};
  let score = Number(baseScore) || 0;
  if (!intent || !cat) return { score, signals };

  const record = (delta, key) => {
    if (!delta) return;
    score += delta;
    signals[key] = (signals[key] || 0) + delta;
  };

  applyIntentRules(intent, cat, record);
  return { score, signals };
}

/** 장소마다 다른 문구가 나오도록 시드(recommendReasonSignals와 동일 규칙) */
function intentReasonVariantSeed(place) {
  const key = `${place?.category_name || ""}|${place?.place_name || place?.name || ""}|${place?.id ?? place?.place_id ?? place?.kakao_place_id ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickIntentReasonVariant(place, phrases, salt = 0) {
  if (!phrases?.length) return "";
  const s = Number(salt) || 0;
  const mixed =
    (intentReasonVariantSeed(place) + s * 374761393) >>> 0;
  return phrases[mixed % phrases.length];
}

function pickTailLine(entry, salt = 0) {
  const arr = Array.isArray(entry) ? entry : entry ? [entry] : [];
  if (!arr.length) return "";
  const s = Number(salt) || 0;
  return arr[s % arr.length];
}

/**
 * 이름·업종·블로그 요약에서 짧은 감각 큐(안주·조명·좌석 등) — DB 큐레이터 본문 없을 때 보조.
 * @param {Record<string, unknown> | null | undefined} place
 * @returns {string}
 */
export function textureSuffixFromPlace(place) {
  if (!place || typeof place !== "object") return "";
  const name = String(place.place_name || place.name || "");
  const cat = String(place.category_name || place.category || "");
  const tags = Array.isArray(place.tags) ? place.tags.join(" ") : "";
  const blob = `${name} ${cat} ${tags}`.toLowerCase();

  const pairs = [
    [/옥상|루프탑|테라스|rooftop|sky/i, "야외·전망 무드가 느껴져요"],
    [/셀러|바이더글래스|와인바|wine/i, "와인 컨셉이 또렷해 보여요"],
    [/칵테일|몰트|gin|위스키바/i, "칵테일·스피릿로 즐기기 좋아 보여요"],
    [/이자카야|야키|꼬치|오뎅|사케/i, "작은 안주 나누기 좋은 술집이에요"],
    [/치즈|샤퀴|플래터|타파스|안주|보틀/i, "안주·페어링 얘기가 나올 만해요"],
    [/룸|프라이빗|private|바텐|카운터/i, "좌석·프라이빗 무드가 있어요"],
    [/어두|다크|조명|무드|감성|로맨|데이트룸/i, "조명·분위기 무드가 살아 있어요"],
    [/브런치|디저트|케이크|커피/i, "디저트·음료로 가볍게 이어가기 좋아요"],
  ];
  for (const [re, msg] of pairs) {
    if (re.test(blob)) return msg;
  }

  const bi = place.blogInsight;
  if (bi && typeof bi === "object") {
    const clip = (s) => {
      const t = String(s || "").trim();
      if (t.length <= 11) return t;
      return `${t.slice(0, 10)}…`;
    };
    const atm = Array.isArray(bi.atmosphere)
      ? bi.atmosphere.find((x) => typeof x === "string" && x.trim().length >= 2)
      : null;
    const menu = Array.isArray(bi.menu)
      ? bi.menu.find((x) => typeof x === "string" && x.trim().length >= 2)
      : null;
    if (atm) return `후기에 「${clip(atm)}」 분위기가 자주 나와요`;
    if (menu) return `「${clip(menu)}」 안주 언급이 많아요`;
    const sum = typeof bi.summary === "string" ? bi.summary.trim() : "";
    if (sum.length >= 8) {
      const one = sum.split(/[\n.!?…]/)[0].trim();
      if (one.length >= 8 && one.length <= 40) return one;
      if (one.length > 40) return `${one.slice(0, 22)}…`;
    }
  }
  return "";
}

function mergeReasonWithTexture(base, place, maxLen = 86) {
  const suf = textureSuffixFromPlace(place);
  if (!suf || !base) return base;
  if (base.includes(suf.slice(0, 6))) return base;
  let out = `${base} · ${suf}`;
  if (out.length > maxLen) out = out.slice(0, maxLen - 1) + "…";
  return out;
}

/** signals 상위 키 → 근거(evidence) 문장 뒤에 붙는 짧은 의도 꼬리 (`salt`로 형제 결과 간 중복 완화) */
function getIntentContextTail(signals, salt = 0) {
  const entries = Object.entries(signals || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "";
  const keys = new Set(entries.map(([k]) => k));
  const TAIL = {
    combo_date_after_quiet_cafe: [
      "소개팅 끝엔 조용히 정리하기 좋아요",
      "얘기 마무리하기 차분한 흐름이에요",
    ],
    combo_date_after_winebar: [
      "소개팅·2차 흐름에 잘 맞아요",
      "분위기 이어 받기 좋아요",
    ],
    combo_date_after_bar: [
      "소개팅 후 2차로 무난해요",
      "가볍게 한 잔 이어가기 좋아요",
    ],
    date_quiet_cafe: [
      "소개팅 후 대화 이어가기 좋아요",
      "조용히 정리하기 좋은 맥락이에요",
    ],
    date_winebar: [
      "소개팅 후 가기 좋아요",
      "데이트 후반 무드 맞추기 좋아요",
      "2차 분위기로 자연스러워요",
      "와인 한 잔으로 톤 맞추기 좋아요",
    ],
    date_bar: [
      "소개팅 후 한 잔 이어가기 좋아요",
      "2차로 부담 덜한 흐름이에요",
      "가볍게 마무리하기 좋아요",
    ],
    date_izakaya: [
      "소개팅 후 2차로 자연스러워요",
      "안주 나누며 이어가기 좋아요",
    ],
    after_winebar: [
      "끝나고 한 잔 이어가기 좋아요",
      "마무리 와인 무드에 잘 맞아요",
    ],
    after_bar: [
      "2차 한 잔에 부담이 덜해요",
      "끝물에 가볍게 앉기 좋아요",
    ],
    after_izakaya: [
      "2차로 안주 골라 먹기 좋아요",
      "작은 접시로 이어가기 좋아요",
    ],
    after_quiet_cafe: [
      "끝나고 조용히 앉기 좋아요",
      "얘기 정리하기 편한 맥락이에요",
    ],
    quiet_cafe: [
      "조용히 얘기 나누기 좋아요",
      "한적하게 앉기 좋아요",
    ],
    quiet_winebar: [
      "차분하게 한 잔하기 좋아요",
      "대화 중심 와인 무드예요",
    ],
    quiet_bar: [
      "대화 중심으로 무난해요",
      "시끄럽지 않은 쪽으로 보여요",
    ],
    drink_venue: [
      "술자리 맥락에 맞아요",
      "한 잔 흐름에 어울려요",
    ],
    intent_cafe_match: [
      "카페로 쉬기 좋아요",
      "잠깐 앉기 좋은 맥락이에요",
    ],
    date_italian: [
      "식사 데이트로 이어가기 좋아요",
      "한 끼 무드로 이어가기 좋아요",
    ],
    date_cafe: [
      "데이트 중 잠깐 쉬기 좋아요",
      "중간 쉼표로 쓰기 좋아요",
    ],
    after_cafe: [
      "2차로 가볍게 앉기 좋아요",
      "디저트·음료로 넘기기 좋아요",
    ],
    overlap_boost: [
      "검색어와도 잘 맞아요",
      "이름·업종이 검색과 잘 겹쳐요",
      "키워드 매칭이 또렷해요",
    ],
  };
  const order = [
    "combo_date_after_quiet_cafe",
    "combo_date_after_winebar",
    "combo_date_after_bar",
    "date_quiet_cafe",
    "date_winebar",
    "date_bar",
    "date_izakaya",
    "after_winebar",
    "after_bar",
    "after_izakaya",
    "after_quiet_cafe",
    "quiet_cafe",
    "quiet_winebar",
    "quiet_bar",
    "drink_venue",
    "intent_cafe_match",
    "date_italian",
    "date_cafe",
    "after_cafe",
    "overlap_boost",
  ];
  for (const k of order) {
    if (keys.has(k) && TAIL[k]) return pickTailLine(TAIL[k], salt);
  }
  return pickTailLine(
    [
      "검색 맥락에 맞아요",
      "의도에 가깝게 골랐어요",
      "조건에 잘 맞물려요",
    ],
    salt
  );
}

/**
 * @param {Record<string, number>} signals — 점수에 쓴 키·가산값(음수는 패널티)
 * @param {Record<string, unknown> | null} [place] — `reasonEvidence`·문구 변주·질감 덧붙임
 * @param {{ phraseSalt?: number }} [opts] — 같은 목록 내 형제 간 문구 중복 완화용
 * @returns {string}
 */
export function buildReasonFromSignals(signals, place = null, opts = null) {
  if (!signals || typeof signals !== "object") return INTENT_SIGNAL_REASON_FALLBACK;

  const phraseSalt =
    opts && typeof opts === "object" && Number.isFinite(Number(opts.phraseSalt))
      ? Number(opts.phraseSalt)
      : 0;

  const p = place && typeof place === "object" ? place : {};

  const entries = Object.entries(signals)
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1]);

  const ev = p.reasonEvidence;
  if (reasonEvidenceHasBody(ev)) {
    const tail =
      entries.length > 0 ? getIntentContextTail(signals, phraseSalt) : "";
    const line = composeWhyFromEvidenceAndTail(ev, tail);
    if (line) return line;
  }

  if (entries.length === 0) return INTENT_SIGNAL_REASON_FALLBACK;

  const top = entries.slice(0, 2).map(([k]) => k);

  const ifTop = (key, phrases) =>
    top.includes(key) && pickIntentReasonVariant(p, phrases, phraseSalt);

  const base =
    ifTop("combo_date_after_quiet_cafe", [
      "소개팅 끝나고 조용히 대화 이어가기 좋은 카페예요",
      "2차로 얘기 정리하기 좋은 차분한 카페예요",
      "한적한 테이블에서 마무리하기 좋은 카페예요",
    ]) ||
    ifTop("combo_date_after_winebar", [
      "소개팅·2차까지 분위기 이어가기 좋은 와인바예요",
      "와인 한 잔으로 톤 맞추기 좋은 자리예요",
      "부담 덜한 와인바로 이어가기 좋아요",
    ]) ||
    ifTop("combo_date_after_bar", [
      "소개팅 끝나고 2차로 가볍게 한잔하기 좋은 바예요",
      "가볍게 마무리하기 좋은 바 무드예요",
      "2차로 자연스럽게 이어지는 바예요",
    ]) ||
    ifTop("date_quiet_cafe", [
      "소개팅 후 조용하게 대화 이어가기 좋은 카페예요",
      "얘기 나누기 편한 한적한 카페예요",
      "차분한 테이블 무드의 카페예요",
    ]) ||
    ifTop("date_winebar", [
      "소개팅 후 분위기 이어가기 좋은 와인바예요",
      "와인 한 잔으로 무드 잡기 좋은 곳이에요",
      "느긋하게 앉아 있기 좋은 와인바예요",
      "대화 이어가기 좋은 와인바 분위기예요",
      "데이트 톤에 잘 맞는 와인바예요",
    ]) ||
    ifTop("date_bar", [
      "소개팅 후 가볍게 한잔하기 좋은 바예요",
      "부담 없이 한 잔 나누기 좋은 바예요",
      "가벼운 칵테일·하이볼로 이어가기 좋아요",
      "2차 전 분위기 맞추기 좋은 바예요",
    ]) ||
    ifTop("date_izakaya", [
      "소개팅 후 자연스럽게 2차로 이어가기 좋아요",
      "안주 골라 먹으며 분위기 풀기 좋은 이자카야예요",
      "작은 접시 나누며 대화하기 좋아요",
    ]) ||
    ifTop("after_winebar", [
      "끝나고 한 잔 이어가기 좋은 와인바예요",
      "와인으로 마무리 무드 잡기 좋아요",
      "느긋한 한 잔에 잘 맞는 와인바예요",
    ]) ||
    ifTop("after_bar", [
      "2차로 부담 덜한 바예요",
      "가볍게 들렀다 가기 좋은 바예요",
      "한 잔으로 정리하기 좋은 바예요",
    ]) ||
    ifTop("after_izakaya", [
      "2차로 안주 골라 먹기 좋은 이자카야예요",
      "꼬치·작은 접시로 이어가기 좋아요",
      "술안주 조합이 다양해 보여요",
    ]) ||
    ifTop("after_quiet_cafe", [
      "끝나고 조용히 앉기 좋은 카페예요",
      "얘기 정리하기 좋은 차분한 카페예요",
    ]) ||
    ifTop("quiet_cafe", [
      "조용히 대화하기 좋은 카페예요",
      "한적한 자리가 나기 좋은 카페예요",
      "차분한 대화에 맞는 카페예요",
    ]) ||
    ifTop("quiet_winebar", [
      "차분하게 한 잔하기 좋은 와인바예요",
      "시끄럽지 않은 와인바로 봤어요",
      "대화 중심으로 앉기 좋은 와인바예요",
    ]) ||
    ifTop("quiet_bar", [
      "대화하기 무난한 바예요",
      "얘기 나누기 편한 바 분위기예요",
      "차분한 쪽 바로 골랐어요",
    ]) ||
    ifTop("drink_venue", [
      "술집·바 맥락에 잘 맞는 후보예요",
      "한 잔 즐기기 좋은 업종이에요",
      "술자리 흐름에 어울려요",
    ]) ||
    ifTop("intent_cafe_match", [
      "카페 찾는 맥락에 맞는 카페예요",
      "잠깐 쉬었다 가기 좋은 카페예요",
    ]) ||
    ifTop("date_italian", [
      "데이트 식사 이어가기 좋은 이탈리안이에요",
      "느긋한 한 끼에 잘 맞는 곳이에요",
      "와인·파스타 무드로 이어가기 좋아요",
    ]) ||
    ifTop("date_cafe", [
      "데이트 중 잠깐 쉬기 좋은 카페예요",
      "대화 이어가기 편한 카페예요",
    ]) ||
    ifTop("after_cafe", [
      "2차로 가볍게 앉기 좋은 카페예요",
      "디저트·음료로 마무리하기 좋아요",
    ]) ||
    ifTop("overlap_boost", [
      "검색어와 이름·업종이 잘 맞아요",
      "이름·카테고리에 검색 키워드가 많이 겹쳐요",
      "검색어와 장소 텍스트가 잘 맞물려요",
    ]) ||
    INTENT_SIGNAL_REASON_FALLBACK;

  return mergeReasonWithTexture(base, p);
}

/** @deprecated 점수만 필요할 때 — 신호는 `applyIntentAxisScoresWithSignals` 사용 */
export function applyIntentAxisScores(intent, cat, baseScore) {
  return applyIntentAxisScoresWithSignals(intent, cat, baseScore).score;
}

export const applyIntentScore = applyIntentAxisScores;
