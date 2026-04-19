import { expandFoodKakaoQueries } from "./searchParser";

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
const key = (s) => norm(s).toLowerCase();

/**
 * 통합 지도 검색(`/api/unified-map-search`)용 `searchPhrases` 보강.
 * 로컬 음식·야장 확장(`expandFoodKakaoQueries`) 뒤에 intent-assist 힌트·폴백을 붙인다.
 *
 * @param {string} kwUnified 카카오/통합에 쓰기로 정리된 한 줄 키워드
 * @param {Record<string, unknown> | null | undefined} intentAssist `/api/search-intent-assist` 응답
 * @param {{ maxPhrases?: number }} [opts] 서버는 보통 10개까지 사용
 * @returns {string[]}
 */
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
    const p = norm(raw);
    if (p.length < 2) return;
    const k = key(p);
    if (seen.has(k)) return;
    seen.add(k);
    ordered.push(p);
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
      push(`${region} ${hint}`.trim());
    }
    if (region && broad && !key(broad).includes(key(region))) {
      push(`${region} ${broad}`.trim());
    }

    const ideas = ia.fallbackSearchIdeas;
    if (Array.isArray(ideas)) {
      for (const idea of ideas.slice(0, 4)) {
        push(idea);
      }
    }
  }

  if (ordered.length === 0 && root) push(root);

  return ordered.slice(0, maxPhrases);
}
