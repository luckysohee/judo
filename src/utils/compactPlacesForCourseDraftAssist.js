const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 큐레이터·DB에 있는 한줄 메모를 LLM용으로 합침 */
export function curatorNoteForCourseDraft(place) {
  if (!place || typeof place !== "object") return "";
  const bits = [
    place.curatorNote,
    place.comment,
    place.one_line_reason,
    place.one_line_review,
    place.menu_reason,
    place.aiText,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return [...new Set(bits)].join(" · ").slice(0, 220);
}

/** LLM·저장 파이프라인 공통 placeKey */
export function placeKeyForCourseDraftAssist(place) {
  if (!place || typeof place !== "object") return "";
  for (const c of [
    place.id,
    place.place_id,
    place._raw?.id,
    place._raw?.place_id,
  ]) {
    const s = c == null ? "" : String(c).trim();
    if (s && UUID_RE.test(s)) return s.toLowerCase();
  }
  const id = String(place.id || "").trim();
  if (id.startsWith("kakao_")) return id;
  const kid =
    place.kakao_place_id != null
      ? String(place.kakao_place_id).trim()
      : place._kakaoDoc?.id != null
        ? String(place._kakaoDoc.id).trim()
        : "";
  if (/^\d+$/.test(kid)) return `kakao_${kid}`;
  return id;
}

/**
 * @param {object[]} places — mapPlaceRowForCourse / mergeCourseSearchWithKakao 형태
 * @param {{ limit?: number }} [opts]
 */
export function compactPlacesForCourseDraftAssist(places, opts = {}) {
  const limit =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(28, Math.floor(opts.limit))
      : 24;
  const seen = new Set();
  const out = [];

  for (const p of Array.isArray(places) ? places : []) {
    const placeKey = placeKeyForCourseDraftAssist(p);
    if (!placeKey || seen.has(placeKey)) continue;
    seen.add(placeKey);
    const curatorNote = curatorNoteForCourseDraft(p);
    out.push({
      placeKey,
      name: String(p.name || p.place_name || "").trim(),
      category: String(p.category || p.category_name || "").trim(),
      address: String(
        p.address || p.address_name || p.road_address_name || ""
      ).trim(),
      region: String(p.region || p.areaName || "").trim(),
      tags: [
        ...(Array.isArray(p.tags) ? p.tags.slice(0, 5).map(String) : []),
        ...(p.isCuratorPick ? ["큐레이터_내픽"] : []),
      ].slice(0, 6),
      comment: curatorNote,
      isCuratorPick: p.isCuratorPick === true,
    });
    if (out.length >= limit) break;
  }

  return out;
}

/** placeKey → 원본 place 객체 */
export function indexPlacesByDraftKey(places) {
  const map = new Map();
  for (const p of Array.isArray(places) ? places : []) {
    const k = placeKeyForCourseDraftAssist(p);
    if (k && !map.has(k)) map.set(k, p);
  }
  return map;
}
