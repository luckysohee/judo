/**
 * 상호·카테고리·태그 기준 계절 메뉴 힌트 — DB에 season 필드가 없을 때 탐색·코스 랭킹 보정.
 * KST 월 기준(한국 음식 시즌 관행).
 */

const WINTER_PEAK_MENU_RE =
  /굴|굴찜|굴구이|굴전|굴요리|굴국|굴보쌈|oyster/i;
const WINTER_PEAK_FISH_RE = /방어회|방어\s*회|방어\s*참|방어\s*무침/i;
const SUMMER_PEAK_MENU_RE =
  /냉면\s*전문|냉면\s*맛집|막걸리\s*냉면|수박\s*주스|빙수\s*전문/i;

const SEASONAL_QUERY_RE =
  /굴|방어|전복|해산물|횟집|회집|생선회|모둠회|물회|회덮밥|조개|해물|수산|겨울\s*메뉴|겨울철|전어|가을\s*전어|여름\s*메뉴|냉면/i;

function placeSeasonalityHaystack(place) {
  if (!place || typeof place !== "object") return "";
  const parts = [
    place.place_name,
    place.name,
    place.category_name,
    place.category,
    place.menu_reason,
    place.recommended_menu,
    place.one_line_review,
  ];
  const pushArr = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      if (x != null && String(x).trim()) parts.push(String(x));
    }
  };
  pushArr(place.categories);
  pushArr(place.tags);
  pushArr(place.food_types);
  pushArr(place.vibes);
  return parts.filter(Boolean).join(" ");
}

/** @returns {'winter'|'spring'|'summer'|'autumn'} */
export function getKstSeasonFromMonth(month) {
  const m = Number(month);
  if (!Number.isFinite(m) || m < 1 || m > 12) return "summer";
  if (m === 12 || m <= 2) return "winter";
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  return "autumn";
}

export function getKstSeason(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return getKstSeasonFromMonth(kst.getUTCMonth() + 1);
}

/** @returns {('winter'|'summer')[]} */
export function detectPlacePeakSeasons(place) {
  const hay = placeSeasonalityHaystack(place);
  if (!hay) return [];
  const peaks = [];
  if (WINTER_PEAK_MENU_RE.test(hay) || WINTER_PEAK_FISH_RE.test(hay)) {
    peaks.push("winter");
  }
  if (SUMMER_PEAK_MENU_RE.test(hay)) {
    peaks.push("summer");
  }
  return peaks;
}

export function queryWantsSeasonalMenu(rawQuery, parsedResult) {
  const q = String(rawQuery || "").toLowerCase();
  if (SEASONAL_QUERY_RE.test(q)) return true;
  const p = parsedResult || {};
  const foods = p.foods?.length ? p.foods : [p.food].filter(Boolean);
  if (foods.includes("해산물")) return true;
  const tags = p.tags || [];
  if (tags.some((t) => /해산물|굴|회|횟집/i.test(String(t)))) return true;
  return false;
}

/**
 * @param {object} [ctx]
 * @param {string} [ctx.rawQuery]
 * @param {object} [ctx.parsedResult]
 * @param {Date} [ctx.now]
 * @returns {number} 음수면 비시즌 감점
 */
export function getSeasonalMenuMismatchPenalty(place, ctx = {}) {
  if (queryWantsSeasonalMenu(ctx.rawQuery, ctx.parsedResult)) return 0;

  const peaks = detectPlacePeakSeasons(place);
  if (!peaks.length) return 0;

  const season = getKstSeason(ctx.now);

  if (peaks.includes("winter") && season !== "winter") {
    if (season === "summer") return -95;
    if (season === "spring" || season === "autumn") return -80;
    return -70;
  }

  if (peaks.includes("summer") && season === "winter") {
    return -65;
  }

  return 0;
}

/** 일반 검색·코스 후보에서 비시즌 강한 메뉴(굴찜 등) 제외 */
export function isSeasonallyMisalignedForDiscovery(place, ctx = {}) {
  return getSeasonalMenuMismatchPenalty(place, ctx) <= -85;
}
