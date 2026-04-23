/** @param {{ summary?: string; query?: string; maxLength?: number }} [opts] */

const DEFAULT_MAX_SUBTITLE = 30;

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 카드 제목과 겹치는 상호·상호 일부 접두 반복 제거 */
function stripLeadingPlaceNameReference(text, place) {
  const name = String(place?.name || place?.place_name || "").trim();
  const orig = String(text || "").trim();
  let s = orig;
  if (!name || !s) return s;
  const variants = [
    name,
    ...name.split(/\s+/).filter((w) => w.length >= 2),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const seen = new Set();
  for (let round = 0; round < 10; round++) {
    let changed = false;
    for (const v of variants) {
      if (seen.has(v) || v.length < 2) continue;
      const re = new RegExp(`^${escapeRegExp(v)}[은는이가에서에]?\\s*`);
      const next = s.replace(re, "").trim();
      if (next !== s) {
        s = next;
        seen.add(v);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return s.length >= 1 ? s : orig;
}

function canStripTokenSuffix(rest) {
  if (!rest.length) return true;
  if (/^[\s,，·…]/.test(rest)) return true;
  if (/^(?:은|는|이|가|에서|에는|에선|에게|으로|와|과|도|만)/.test(rest)) {
    return true;
  }
  return false;
}

/** 검색어를 앞에서부터 순서대로만 제거(한 단어가 본문 첫머리와 붙은 경우는 건드리지 않음) */
function stripSequentialQueryPrefixFromLine(line, rawQuery) {
  const orig = String(line || "").trim();
  let s = orig;
  const tokens = String(rawQuery || "")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (!s || !tokens.length) return s;
  const low = (x) => String(x).toLowerCase();
  let guard = 0;
  while (guard++ < 24) {
    let changed = false;
    for (const t of tokens) {
      if (!t || !s) break;
      const tl = low(t);
      const sl = low(s);
      if (!sl.startsWith(tl)) continue;
      const rest = s.slice(t.length);
      if (!canStripTokenSuffix(rest)) continue;
      s = rest.replace(/^[\s,，·…은는이가에서에의으로와과]+/, "").trim();
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return s.length >= 2 ? s : orig;
}

function stripLeadingNoiseClauses(text) {
  let s = String(text || "").trim();
  s = s.replace(/^(?:추천하기|검색)\s+/i, "").trim();
  s = s.replace(/^추천\s+/i, "").trim();
  s = s.replace(/^(?:그래서|또한|한편|특히|일단)\s+/i, "").trim();
  return s;
}

/** 요약 tail이 가게명 직후라 «을/를 …»만 남은 경우 */
function stripGenericReviewFluff(text) {
  return String(text || "")
    .replace(/맛집\s*후기/gi, " ")
    .replace(/블로그\s*후기/gi, " ")
    .replace(/네이버\s*후기/gi, " ")
    .replace(/검색\s*후기/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 모델이 굵게 표시한 `**이름**` 등 — React 한 줄에 그대로 나오는 것 방지 */
function stripMarkdownAsterisks(text) {
  return String(text || "")
    .replace(/\*{1,3}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 같은 추천 배치에 있는 다른 가게 상호가 이 카드 `reason`에 끼어든 경우 제거.
 * 3글자 미만은 제외(오탐). 긴 상호만 오고 본문은 끝 브랜드만 말하는 경우 → 공백 분절 4글자↑ 토큰도 목록에 포함.
 */
function stripOtherBatchPlaceNames(text, siblingNames) {
  let s = String(text || "").trim();
  if (!s || !Array.isArray(siblingNames) || !siblingNames.length) return s;
  const names = [
    ...new Set(
      siblingNames
        .map((n) => String(n ?? "").trim())
        .filter((n) => n.length >= 3),
    ),
  ].sort((a, b) => b.length - a.length);
  for (const n of names) {
    const re = new RegExp(escapeRegExp(n), "g");
    s = s.replace(re, " ");
  }
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/\s+(?:을|를)\s+/g, " ").trim();
  }
  s = s
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*(?:와|과|및|,)\s+/, "")
    .replace(/\s+(?:와|과)\s*$/, "")
    .trim();
  return s;
}

/**
 * `/recommend` places[] 등에서 현재 카드와 다른 행의 상호 목록 (부제 정리용)
 */
export function siblingPlaceNamesFromBatch(places, currentPlace) {
  if (!Array.isArray(places) || !currentPlace || typeof currentPlace !== "object")
    return [];
  const curId =
    currentPlace.id != null && String(currentPlace.id).trim() !== ""
      ? String(currentPlace.id)
      : "";
  const curName = String(
    currentPlace.name || currentPlace.place_name || "",
  )
    .trim()
    .toLowerCase();
  const out = [];
  for (const p of places) {
    if (!p || typeof p !== "object") continue;
    if (curId && p.id != null && String(p.id) === curId) continue;
    const pn = String(p.name || p.place_name || "")
      .trim()
      .toLowerCase();
    if (!curId && curName && pn && pn === curName) continue;
    const n = String(p.name || p.place_name || "").trim();
    if (n.length >= 2) {
      out.push(n);
      /** 예: "을지로 와인바 언오디너리" — 이유 문장엔 "언오디너리"만 나오는 경우 */
      for (const tok of n.split(/\s+/)) {
        if (tok.length >= 4) out.push(tok);
      }
    }
  }
  const seen = new Set();
  const uniq = [];
  for (const n of out.sort((a, b) => b.length - a.length)) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(n);
  }
  return uniq;
}

/** 한 줄 안에 상호가 두 번 이상 나오면 첫 번만 남김 */
function stripRepeatedPlaceName(text, place) {
  const name = String(place?.name || place?.place_name || "").trim();
  let s = String(text || "").trim();
  if (!name || name.length < 2) return s;
  let guard = 0;
  while (guard++ < 8) {
    const first = s.indexOf(name);
    if (first < 0) break;
    const second = s.indexOf(name, first + name.length);
    if (second < 0) break;
    s = (s.slice(0, second) + s.slice(second + name.length))
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return s;
}

function stripLeadingIncompleteHangulClause(text) {
  let s = String(text || "").trim();
  let n = 0;
  while (n++ < 12 && s.length > 0) {
    if (/^(?:을|를|이|가|은|는|도|만|에|의|와|과)\s/.test(s)) {
      s = s.replace(/^(?:을|를|이|가|은|는|도|만|에|의|와|과)\s+/, "").trim();
      continue;
    }
    if (/^(?:에서|에는|에선|으로|와서)\s/.test(s)) {
      s = s.replace(/^(?:에서|에는|에선|으로|와서)\s+/, "").trim();
      continue;
    }
    break;
  }
  return s.trim();
}

/** 검색어 전체가 한 줄 앞에 그대로 붙은 경우만 제거(토큰 단위 제거는 본문 와인·강남 등을 망가뜨림) */
function stripLeadingSearchEcho(text, rawQuery) {
  const orig = String(text || "").trim();
  const q = String(rawQuery || "").trim().replace(/\s+/g, " ");
  if (!orig || !q) return orig;
  const low = (x) => String(x).toLowerCase();
  if (low(orig).startsWith(low(q))) {
    const s = orig
      .slice(q.length)
      .replace(/^[\s,.·…]+/, "")
      .trim();
    return s.length >= 2 ? s : orig;
  }
  return orig;
}

function compactSingleLine(text, maxLen) {
  const max = typeof maxLen === "number" && maxLen > 12 ? maxLen : DEFAULT_MAX_SUBTITLE;
  const one = String(text || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!one) return "";
  if (one.length <= max) return one;
  const cut = one.slice(0, max - 1).trimEnd();
  return cut ? `${cut}…` : "…";
}

function coreReasonAndSignals(place) {
  if (!place || typeof place !== "object") return "";
  const rs = String(place.reasonShort ?? "").trim();
  if (rs) return rs;
  const r = String(place.reason ?? "").trim();
  if (r) return r;
  const raw = place.signals;
  const sigs = Array.isArray(raw)
    ? raw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  if (sigs.length) return sigs[0];
  return "";
}

function lineFromSummaryForPlace(place, summaryText) {
  const summary = String(summaryText || "").trim();
  if (!summary) return "";
  const name = String(place?.name || place?.place_name || "").trim();
  if (!name) return "";
  if (summary.includes(name)) {
    const idx = summary.indexOf(name);
    let tail = summary.slice(idx + name.length).trim();
    tail = tail
      .replace(/^[,，、\-—–:]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (tail.length >= 2) {
      const t2 = stripLeadingIncompleteHangulClause(tail);
      return t2.length >= 2 ? t2 : tail;
    }
    /** 이름 앞 문장은 대개 지역·검색 맥락이라 부제에 쓰지 않음 → 바로 이유만 */
  }
  const parts = name.split(/\s+/).filter((t) => t.length >= 2);
  for (const tok of parts) {
    const j = summary.indexOf(tok);
    if (j < 0) continue;
    let tail = summary.slice(j + tok.length).trim();
    tail = tail
      .replace(/^[,，、\-—–:]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (tail.length >= 2) {
      const t2 = stripLeadingIncompleteHangulClause(tail);
      return t2.length >= 2 ? t2 : tail;
    }
  }
  return "";
}

/**
 * place_import_tmp `/recommend` places[] — 부제 한 줄(짧게)
 */
export function recommendPlaceSubtitle(place, opts) {
  const q =
    opts && typeof opts.query === "string" ? opts.query.trim() : "";
  const siblingNames =
    opts && Array.isArray(opts.siblingNames) ? opts.siblingNames : null;
  const core = coreReasonAndSignals(place);
  const fromReasonShort =
    String(place?.reasonShort ?? "").trim() &&
    String(core || "").trim() === String(place.reasonShort ?? "").trim();
  const maxLen =
    opts && typeof opts.maxLength === "number" && opts.maxLength > 12
      ? opts.maxLength
      : fromReasonShort
        ? 56
        : DEFAULT_MAX_SUBTITLE;
  let raw = core;
  if (!raw) {
    const summary = opts && typeof opts.summary === "string" ? opts.summary : "";
    raw = lineFromSummaryForPlace(place, summary);
  }
  raw = stripMarkdownAsterisks(raw);
  let line = stripLeadingPlaceNameReference(raw, place);
  if (q) {
    line = stripLeadingSearchEcho(line, q);
    line = stripSequentialQueryPrefixFromLine(line, q);
  }
  line = stripLeadingPlaceNameReference(line, place);
  line = stripLeadingNoiseClauses(line);
  if (q) line = stripSequentialQueryPrefixFromLine(line, q);
  line = stripLeadingPlaceNameReference(line, place);
  line = stripLeadingIncompleteHangulClause(line);
  line = stripGenericReviewFluff(line);
  line = stripRepeatedPlaceName(line, place);
  line = stripOtherBatchPlaceNames(line, siblingNames);
  line = stripLeadingIncompleteHangulClause(line);
  return compactSingleLine(line, maxLen);
}
