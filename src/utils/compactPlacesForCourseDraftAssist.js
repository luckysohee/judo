import { scoreNopoSignals } from "./nopoSearchProfile.js";
import { blogInsightToCourseEvidence } from "./coursePlaceDiscovery.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 큐레이터·DB·블로그 근거를 LLM용 한줄로 합침 */
export function curatorNoteForCourseDraft(place) {
  if (!place || typeof place !== "object") return "";
  const { commentBits: blogBits } = blogInsightToCourseEvidence(
    place.blogInsight
  );
  const bits = [
    place.curatorNote,
    place.comment,
    place.one_line_reason,
    place.one_line_review,
    place.menu_reason,
    place.aiText,
    ...blogBits,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return [...new Set(bits)].join(" · ").slice(0, 280);
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
    const nopo = scoreNopoSignals(p);
    const { tags: blogTags } = blogInsightToCourseEvidence(p.blogInsight);
    const hasBlog =
      p.hasBlogEvidence === true ||
      (p.blogInsight != null && typeof p.blogInsight === "object");
    out.push({
      placeKey,
      name: String(p.name || p.place_name || "").trim(),
      category: String(p.category || p.category_name || "").trim(),
      address: String(
        p.address || p.address_name || p.road_address_name || ""
      ).trim(),
      region: String(p.region || p.areaName || "").trim(),
      tags: [
        ...(Array.isArray(p.tags) ? p.tags.map(String) : []),
        ...blogTags,
        ...(p.isCuratorPick ? ["큐레이터_내픽"] : []),
        ...(hasBlog ? ["블로그근거"] : []),
      ]
        .filter(Boolean)
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .slice(0, 8),
      comment: curatorNote,
      isCuratorPick: p.isCuratorPick === true,
      hasBlogEvidence: hasBlog,
      nopoScore: nopo.score,
      nopoOk: !nopo.disallowed && nopo.score >= 3,
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
