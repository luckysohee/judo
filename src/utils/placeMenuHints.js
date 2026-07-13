/**
 * 장소 미리보기용 메뉴 힌트 — 큐레이터·블로그에 이미 있는 텍스트만 모음.
 * (카카오/구글 메뉴 API 없음)
 */

function pushUnique(list, raw) {
  const t = String(raw ?? "").trim();
  if (!t) return;
  const parts = t.split(/[,，、/·|]+/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (p.length > 48) continue;
    if (!list.some((x) => x.toLowerCase() === p.toLowerCase())) {
      list.push(p);
    }
  }
}

/**
 * @param {object|null|undefined} place
 * @returns {{
 *   items: string[],
 *   notes: string[],
 *   hasAny: boolean,
 * }}
 */
export function collectPlaceMenuHints(place) {
  const items = [];
  const notes = [];

  if (!place || typeof place !== "object") {
    return { items, notes, hasAny: false };
  }

  pushUnique(items, place.recommended_menu);

  for (const cp of Array.isArray(place.curatorPlaces) ? place.curatorPlaces : []) {
    if (!cp || typeof cp !== "object") continue;
    pushUnique(items, cp.recommended_menu);
    const reason = String(cp.menu_reason ?? "").trim();
    if (!reason) continue;
    if (reason.length <= 36) {
      pushUnique(items, reason);
    } else if (!notes.some((n) => n === reason)) {
      notes.push(reason.slice(0, 120));
    }
  }

  const blogMenus = place.blogInsight?.menu;
  if (Array.isArray(blogMenus)) {
    for (const m of blogMenus) pushUnique(items, m);
  }

  return {
    items: items.slice(0, 10),
    notes: notes.slice(0, 2),
    hasAny: items.length > 0 || notes.length > 0,
  };
}
