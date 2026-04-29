/**
 * 바텀시트 추천 리스트 제목 — DB `place_name`이 수집 키워드 조각인 경우
 * `title`(블로그 제목) 앞부분 등으로 상호를 고른다. (recommend._canonical_place_name_row 와 맞춤)
 */
const THEME_KW_RE =
  /(맛집|데이트\s*코스|분위기\s*좋|핫플|가볼만|소개팅|모임|역맛집|검색결과|키워드|기념일|주제|에\s*가기|하기\s*좋은|가기\s*좋은|한잔하기|나들이|비스트로)/i;

function looksLikeThemeOrKeywordTitle(s) {
  const t = String(s || "").trim();
  if (!t || t.length < 2) return true;
  if (THEME_KW_RE.test(t)) return true;
  if (/(에\s*가기|하기\s*좋은|가기\s*좋은)\s*$/i.test(t.trim())) return true;
  if (/^[가-힣0-9]+\s*동\s+(카페|바|술집|음식점|와인바|노포)\s*$/i.test(t.trim())) {
    return true;
  }
  return false;
}

function clipBlogTitleHead(title, maxLen = 56) {
  const t = String(title || "").trim();
  if (!t) return "";
  const seps = [" 방문", " 후기", " 추천", " 리뷰", " | ", " - "];
  for (const sep of seps) {
    const i = t.indexOf(sep);
    if (i >= 4 && i <= 80) {
      const head = t.slice(0, i).trim();
      if (head.length >= 2) return head.slice(0, maxLen).trim();
    }
  }
  return t.length > maxLen ? `${t.slice(0, maxLen - 1).trim()}…` : t;
}

export function pickAiSheetPlaceDisplayName(place) {
  if (!place || typeof place !== "object") return "알 수 없는 장소";

  const keys = [
    "place_name",
    "official_name",
    "business_name",
    "store_name",
    "name",
    "title",
  ];
  const candidates = [];
  for (const k of keys) {
    const v = place[k];
    if (v && String(v).trim()) candidates.push(String(v).trim());
  }

  const rawTitle = String(place.title || "").trim();
  if (rawTitle) {
    const clipped =
      rawTitle.includes(" 방문") ||
      rawTitle.includes(" 후기") ||
      rawTitle.length > 28
        ? clipBlogTitleHead(rawTitle)
        : rawTitle;
    if (
      clipped &&
      clipped !== rawTitle &&
      !looksLikeThemeOrKeywordTitle(clipped)
    ) {
      return clipped.slice(0, 120);
    }
  }

  for (const c of candidates) {
    if (!looksLikeThemeOrKeywordTitle(c)) return c.slice(0, 120);
  }

  if (rawTitle.length > 8) {
    const c = clipBlogTitleHead(rawTitle);
    if (c && !looksLikeThemeOrKeywordTitle(c)) return c.slice(0, 120);
  }

  return (candidates[0] || "알 수 없는 장소").slice(0, 120);
}
