/**
 * 5단계: AI는 검색 “전체”가 아니라 “보조”
 *
 * 주도: 지도·로컬 API(카카오 등)로 후보를 가져온 뒤, AI는 태그/의도/키워드만 다룬다.
 *
 * AI가 하면 좋은 일
 * - 자연어 → 태그·필터(무드, 목적, 주종, 안주 무게감 등)
 * - 오타·비슷한 표현 정리
 * - 검색 의도 요약
 * - 결과가 비었을 때 “다시 칠 검색어” 아이디어만 제안(실제 장소명 단정 금지)
 *
 * AI가 하면 안 되는 일
 * - 데이터에 없는 장소를 지어내 추천
 * - 근거 없이 “여기 좋아요”
 * - 자유 챗봇처럼 장소 후보를 나열·발명
 *
 * 서버: POST /api/search-intent-assist — kakaoKeywordHint, broadKakaoKeyword(넓힌 키워드), fallbackSearchIdeas 등
 */

const AI_API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_API_BASE_URL
    ? String(import.meta.env.VITE_AI_API_BASE_URL).replace(/\/$/, "")
    : "";

/**
 * @param {string} query
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchSearchIntentAssist(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const url = AI_API_BASE ? `${AI_API_BASE}/api/search-intent-assist` : "/api/search-intent-assist";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });

  if (!res.ok) return null;
  return res.json();
}

/**
 * 룰 파서 결과와 의도 보조 결과를 합칠 때(향후 UI/스코어에 사용)
 * @param {Record<string, unknown>} ruleParsed
 * @param {Record<string, unknown> | null} assist
 */
export function mergeRuleParseWithAssist(ruleParsed, assist) {
  const h = assist?.filterHints;
  if (!h || typeof h !== "object") return ruleParsed;
  return {
    ...ruleParsed,
    region: ruleParsed.region || h.regionHint || null,
    alcohol: ruleParsed.alcohol || h.alcoholScope || null,
    situation: ruleParsed.situation || h.situation || h.purpose || null,
    vibe: ruleParsed.vibe || h.vibe || null,
    food: ruleParsed.food || h.foodOrSnackWeight || null,
  };
}
