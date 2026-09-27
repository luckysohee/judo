/**
 * 추천 메뉴 문자열 → 카드용 1~3개 라벨.
 * 예: "삼겹살, 냉면 · 소주안주" → ["삼겹살", "냉면", "소주안주"]
 *
 * @param {unknown} raw
 * @param {number} [max=3]
 * @returns {string[]}
 */
export function parseSignatureMenus(raw, max = 3) {
  const limit = Math.max(1, Math.min(6, Number(max) || 3));
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .slice(0, limit);
  }
  const s = String(raw).trim();
  if (!s) return [];
  return s
    .split(/[,，、·|/｜\n]+/u)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * place / curatorPlaces 에서 대표 메뉴 1~3개 추출.
 * @param {object|null|undefined} place
 * @returns {string[]}
 */
export function signatureMenusFromPlace(place) {
  if (!place || typeof place !== "object") return [];
  const fromTop = parseSignatureMenus(place.recommended_menu);
  if (fromTop.length) return fromTop;

  for (const cp of place.curatorPlaces || []) {
    const menus = parseSignatureMenus(cp?.recommended_menu);
    if (menus.length) return menus;
  }
  return [];
}
