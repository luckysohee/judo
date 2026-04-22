import { normalizeHangulSearchCompounds } from "./searchParser.js";

/**
 * 코스(1·2·3차)·루트 의도 — 일반 "걸어서 근처" 검색과 섞이지 않게
 * 도보/걸어서는 1차·2차·코스·루트 등과 같이 있을 때만 true.
 */
export function isCourseQuery(query = "") {
  const text = normalizeHangulSearchCompounds(query).trim();
  if (!text) return false;

  const hasRoundOrRoute =
    /(?:1\s*차|2\s*차|3\s*차|일\s*차|이\s*차|삼\s*차)/i.test(text) ||
    /코스|루트|코스\s*짜|짜\s*줘|이어서|옮겨|가볍게\s*한잔/i.test(text);

  const walkHint = /걸어서|도보|walking|walk\b/i.test(text);

  if (hasRoundOrRoute) return true;
  if (walkHint && /(?:1\s*차|2\s*차|3\s*차|코스|루트)/i.test(text)) return true;
  return false;
}
