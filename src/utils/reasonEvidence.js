/**
 * 실시간 지도 후보에 붙는 추천 근거 묶음.
 * merge·스코어링 단계에서 채우고, `buildReasonFromSignals`가 signals와 합쳐 한 줄을 만든다.
 */

function uniqNonEmptyStrings(arr, max) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = typeof x === "string" ? x.trim() : "";
    if (s.length < 2 || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * @param {Record<string, unknown> | null | undefined} place
 * @returns {{ summary: string, atmosphere: string[], menu: string[], curatorLines: string[], tags: string[], source: string }}
 */
export function collectReasonEvidence(place) {
  const empty = {
    summary: "",
    atmosphere: [],
    menu: [],
    curatorLines: [],
    tags: [],
    source: "inferred",
  };
  if (!place || typeof place !== "object") return empty;

  const atmosphere = [];
  const menu = [];
  let summary = "";
  const sources = new Set();
  const tags = uniqNonEmptyStrings(place.tags, 12);

  const bi = place.blogInsight;
  if (bi && typeof bi === "object") {
    atmosphere.push(...uniqNonEmptyStrings(bi.atmosphere, 10));
    menu.push(...uniqNonEmptyStrings(bi.menu, 10));
    menu.push(...uniqNonEmptyStrings(bi.drink, 6));
    const sum = String(bi.summary || "").trim();
    if (sum.length >= 8) {
      summary = sum;
      sources.add("blog");
    }
  }

  const curatorLines = [];
  if (place.curatorReasons && typeof place.curatorReasons === "object") {
    for (const v of Object.values(place.curatorReasons)) {
      const s = String(v || "").trim();
      if (s.length >= 4) curatorLines.push(s);
    }
  }
  if (Array.isArray(place.curatorPlaces)) {
    for (const cp of place.curatorPlaces) {
      for (const key of ["one_line_reason", "menu_reason", "one_line_review"]) {
        const s = String(cp?.[key] || "").trim();
        if (s.length >= 4) curatorLines.push(s);
      }
    }
  }
  const curatorU = uniqNonEmptyStrings(curatorLines, 4);
  if (curatorU.length) {
    sources.add("curator");
    if (!summary) summary = curatorU[0];
  }

  const atmosphereU = uniqNonEmptyStrings(atmosphere, 12);
  const menuU = uniqNonEmptyStrings(menu, 12);

  let source = "inferred";
  if (sources.has("blog") && sources.has("curator")) source = "mixed";
  else if (sources.has("blog")) source = "blog";
  else if (sources.has("curator")) source = "curator";
  else if (
    atmosphereU.length ||
    menuU.length ||
    tags.length >= 2 ||
    (tags.length === 1 && tags[0].length >= 3)
  ) {
    source = "db";
  }

  return {
    summary: summary.slice(0, 220),
    atmosphere: atmosphereU,
    menu: menuU,
    curatorLines: curatorU,
    tags: tags.slice(0, 10),
    source,
  };
}

/**
 * @param {ReturnType<typeof collectReasonEvidence>} ev
 */
export function reasonEvidenceHasBody(ev) {
  if (!ev || typeof ev !== "object") return false;
  if (String(ev.summary || "").trim().length >= 8) return true;
  if (ev.atmosphere?.some((s) => String(s).trim().length >= 2)) return true;
  if (ev.menu?.some((s) => String(s).trim().length >= 2)) return true;
  if (ev.curatorLines?.some((s) => String(s).trim().length >= 4)) return true;
  if (ev.tags && ev.tags.length >= 2) return true;
  if (ev.tags?.length === 1 && String(ev.tags[0]).trim().length >= 3) return true;
  return false;
}

/**
 * @param {ReturnType<typeof collectReasonEvidence>} ev
 * @param {number} maxLen
 */
export function buildEvidenceHead(ev, maxLen = 46) {
  const sum = String(ev.summary || "").trim();
  if (sum.length >= 10) {
    return sum.length > maxLen ? `${sum.slice(0, maxLen - 1)}…` : sum;
  }
  const parts = [];
  const atm = (ev.atmosphere || []).filter(Boolean).slice(0, 2);
  if (atm.length) parts.push(`${atm.join("·")} 분위기`);
  const mn = (ev.menu || []).filter(Boolean).slice(0, 2);
  if (mn.length) parts.push(`${mn.join("·")} 쪽 언급`);
  if (!parts.length && ev.curatorLines?.[0]) {
    const c = String(ev.curatorLines[0]).trim();
    return c.length > maxLen ? `${c.slice(0, maxLen - 1)}…` : c;
  }
  if (!parts.length && ev.tags?.length) {
    const t = ev.tags
      .filter(Boolean)
      .slice(0, 3)
      .join("·");
    if (t) parts.push(`${t} 태그`);
  }
  let s = parts.join(" · ");
  if (!s) return "";
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}…`;
  return s;
}

/**
 * @param {ReturnType<typeof collectReasonEvidence>} ev
 * @param {string} tail — 검색 의도(signals)에서 온 짧은 꼬리
 */
export function composeWhyFromEvidenceAndTail(ev, tail) {
  const head = buildEvidenceHead(ev);
  if (!head) return "";
  const t = String(tail || "").trim();
  if (t) {
    let out = `${head} 쪽이라 ${t}`;
    if (out.length > 96) out = `${out.slice(0, 95)}…`;
    return out;
  }
  let out = `${head} 쪽으로 골랐어요`;
  if (out.length > 96) out = `${out.slice(0, 95)}…`;
  return out;
}
