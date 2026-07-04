/**
 * 큐레이터·places DB 메타를 스코어링·취향 blob용 top-level 필드로 올림.
 * (기존 등록 장소 — places.one_line_review, curator_places.one_line_reason 등)
 */

function parseStrArray(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }
    return s
      .split(/[,·|/]/u)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

/**
 * @param {object|null|undefined} source catalogHit · join aggregate · evidencePlace
 * @returns {{
 *   one_line_review?: string,
 *   recommended_menu?: string,
 *   menu_reason?: string,
 *   price_range?: string,
 *   atmosphere?: string,
 *   visit_situations: string[],
 *   alcohol_types: string[],
 *   liquor_types: string[],
 *   purposes: string[],
 *   food_types: string[],
 * }}
 */
export function liftCuratorCatalogMeta(source) {
  if (!source || typeof source !== "object") {
    return {
      visit_situations: [],
      alcohol_types: [],
      liquor_types: [],
      purposes: [],
      food_types: [],
    };
  }

  const visitSet = new Set(parseStrArray(source.visit_situations));
  const alcoholSet = new Set([
    ...parseStrArray(source.alcohol_types),
    ...parseStrArray(source.liquor_types),
  ]);
  const purposeSet = new Set(parseStrArray(source.purposes));
  const foodSet = new Set(parseStrArray(source.food_types));

  if (source.alcohol_type) {
    alcoholSet.add(String(source.alcohol_type).trim());
  }

  let oneLine = firstNonEmpty(source.one_line_review);
  let recommendedMenu = firstNonEmpty(source.recommended_menu);
  let menuReason = firstNonEmpty(source.menu_reason);
  let priceRange = firstNonEmpty(source.price_range);
  let atmosphere = firstNonEmpty(source.atmosphere);

  for (const cp of source.curatorPlaces || []) {
    if (!cp || typeof cp !== "object") continue;
    const pl = cp.places && typeof cp.places === "object" ? cp.places : null;

    oneLine = firstNonEmpty(
      oneLine,
      cp.one_line_reason,
      cp.one_line_review,
      pl?.one_line_review
    );
    recommendedMenu = firstNonEmpty(
      recommendedMenu,
      cp.recommended_menu,
      pl?.recommended_menu
    );
    menuReason = firstNonEmpty(menuReason, cp.menu_reason, pl?.menu_reason);
    priceRange = firstNonEmpty(priceRange, cp.price_range, pl?.price_range);
    atmosphere = firstNonEmpty(atmosphere, cp.atmosphere, pl?.atmosphere);

    for (const v of parseStrArray(cp.visit_situations)) visitSet.add(v);
    if (pl) {
      for (const v of parseStrArray(pl.visit_situations)) visitSet.add(v);
    }
    for (const a of parseStrArray(cp.alcohol_types)) alcoholSet.add(a);
    if (pl) {
      for (const a of parseStrArray(pl.alcohol_types)) alcoholSet.add(a);
      if (pl.alcohol_type) alcoholSet.add(String(pl.alcohol_type).trim());
    }
    for (const p of parseStrArray(cp.purposes)) purposeSet.add(p);
    for (const f of parseStrArray(cp.food_types)) foodSet.add(f);
  }

  if (source.curatorReasons && typeof source.curatorReasons === "object") {
    for (const v of Object.values(source.curatorReasons)) {
      const s = String(v ?? "").trim();
      if (s.length >= 4) {
        oneLine = firstNonEmpty(oneLine, s);
        break;
      }
    }
  }

  /** @type {Record<string, unknown>} */
  const out = {
    visit_situations: [...visitSet],
    alcohol_types: [...alcoholSet],
    liquor_types: [...alcoholSet],
    purposes: [...purposeSet],
    food_types: [...foodSet],
  };

  if (oneLine) out.one_line_review = oneLine;
  if (recommendedMenu) out.recommended_menu = recommendedMenu;
  if (menuReason) out.menu_reason = menuReason;
  if (priceRange) out.price_range = priceRange;
  if (atmosphere) out.atmosphere = atmosphere;

  return out;
}

/**
 * 취향 blob용 추가 텍스트 (curatorReasons 전체·cp 한줄평)
 * @param {object|null|undefined} place
 */
export function curatorMetaTextForTasteBlob(place) {
  if (!place || typeof place !== "object") return "";

  const parts = [];
  const lifted = liftCuratorCatalogMeta(place);
  if (lifted.one_line_review) parts.push(lifted.one_line_review);
  if (lifted.recommended_menu) parts.push(lifted.recommended_menu);
  if (lifted.menu_reason) parts.push(lifted.menu_reason);

  if (place.curatorReasons && typeof place.curatorReasons === "object") {
    for (const v of Object.values(place.curatorReasons)) {
      const s = String(v ?? "").trim();
      if (s.length >= 2) parts.push(s);
    }
  }

  for (const cp of place.curatorPlaces || []) {
    for (const key of [
      "one_line_reason",
      "one_line_review",
      "menu_reason",
      "recommended_menu",
    ]) {
      const s = String(cp?.[key] ?? "").trim();
      if (s.length >= 2) parts.push(s);
    }
    const pl = cp?.places;
    if (pl && typeof pl === "object") {
      for (const key of ["one_line_review", "menu_reason", "recommended_menu"]) {
        const s = String(pl[key] ?? "").trim();
        if (s.length >= 2) parts.push(s);
      }
    }
  }

  return [...new Set(parts)].join(" ");
}
