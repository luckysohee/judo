/**
 * Studio AI 코스 — 장소 발굴 본체.
 * AI가 검색어를 넓히고, 카카오·네이버·(선택) 블로그로 실제 POI를 모은 뒤
 * 블로그 근거를 후보에 붙인다. LLM은 이 목록 안에서만 코스를 짠다.
 */

import {
  buildPartyCourseSearchPhrases,
  refineSearchPhrasesForCourseIntent,
} from "./filterPlacesForCourseSuggestionIntent.js";
import { queryWantsNopoFoodFocus } from "./searchParser.js";

/**
 * 블로그 insight → 코스 후보 comment·tags용 텍스트
 * @param {object|null|undefined} blogInsight
 */
export function blogInsightToCourseEvidence(blogInsight) {
  if (!blogInsight || typeof blogInsight !== "object") {
    return { commentBits: [], tags: [] };
  }
  const tags = [
    ...(Array.isArray(blogInsight.atmosphere) ? blogInsight.atmosphere : []),
    ...(Array.isArray(blogInsight.menu) ? blogInsight.menu : []),
    ...(Array.isArray(blogInsight.drink) ? blogInsight.drink : []),
    ...(Array.isArray(blogInsight.purpose) ? blogInsight.purpose : []),
  ]
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const commentBits = [];
  const summary = String(blogInsight.summary || "").trim();
  if (summary) commentBits.push(summary);
  if (tags.length) commentBits.push(`블로그: ${tags.slice(0, 5).join(", ")}`);
  const n = Number(blogInsight.reviewCount);
  if (Number.isFinite(n) && n > 0) {
    commentBits.push(`후기 ${n}건`);
  }

  return { commentBits, tags };
}

/**
 * unified-map-search place → 코스 히트에 blogInsight·comment 반영
 * @param {object} hit — course hit
 * @param {object} [unifiedPlace]
 */
export function attachBlogInsightToCourseHit(hit, unifiedPlace) {
  if (!hit || typeof hit !== "object") return hit;
  const bi =
    unifiedPlace?.blogInsight ||
    hit.blogInsight ||
    null;
  if (!bi) return hit;

  const { commentBits, tags } = blogInsightToCourseEvidence(bi);
  const prevComment = String(hit.comment || "").trim();
  const mergedComment = [...new Set([prevComment, ...commentBits].filter(Boolean))]
    .join(" · ")
    .slice(0, 280);
  const prevTags = Array.isArray(hit.tags) ? hit.tags.map(String) : [];
  const mergedTags = [...new Set([...prevTags, ...tags])].slice(0, 10);

  return {
    ...hit,
    blogInsight: bi,
    comment: mergedComment,
    tags: mergedTags,
    hasBlogEvidence: true,
  };
}

/**
 * AI intent + 규칙으로 장소 검색 phrase 목록 구성
 * @param {string} query
 * @param {object|null} parsed
 * @param {object|null} intentAssist — search-intent-assist 응답
 */
export function planCoursePlaceSearchPhrases(query, parsed, intentAssist) {
  const trimmed = String(query || "").replace(/\s+/g, " ").trim();
  const area = String(parsed?.area || "").trim();
  const wantsNopo = queryWantsNopoFoodFocus(trimmed, null);
  const phrases = [trimmed];

  const broad = String(intentAssist?.broadKakaoKeyword || "").trim();
  const hint = String(intentAssist?.kakaoKeywordHint || "").trim();
  if (broad) phrases.push(broad);
  if (hint && hint !== broad && hint !== trimmed) phrases.push(hint);

  for (const idea of Array.isArray(intentAssist?.fallbackSearchIdeas)
    ? intentAssist.fallbackSearchIdeas
    : []) {
    const s = String(idea || "").trim();
    if (s.length >= 2) phrases.push(s);
  }

  phrases.push(...buildPartyCourseSearchPhrases(trimmed, parsed));

  if (area) {
    if (wantsNopo) {
      phrases.push(
        `${area} 노포`,
        `${area} 포차`,
        `${area} 막걸리`,
        `${area} 선술집`,
        `${area} 골목 포차`
      );
    } else {
      const theme = trimmed
        .replace(new RegExp(area, "gi"), "")
        .replace(/코스|루트|추천|짜줘|만들어/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (theme) phrases.push(`${area} ${theme}`);
      phrases.push(`${area} 맛집`, `${area} 술집`, `${area} 카페`);
    }
  }

  let planned = refineSearchPhrasesForCourseIntent(
    trimmed,
    [...new Set(phrases.map((p) => String(p || "").trim()).filter((p) => p.length >= 2))],
    parsed
  );
  // 노포 질의: AI가 넣은 「맛집·식당·음식점」은 신생·체인만 잔뜩 불러옴 → 제거
  if (wantsNopo) {
    planned = planned.filter(
      (p) =>
        !/(?:^|\s)(맛집|식당|음식점|카페)(?:\s|$)/i.test(p) ||
        /노포|포차|막걸리|선술|골목/.test(p)
    );
  }
  return planned.slice(0, 10);
}

/**
 * 같은 placeKey면 blog/comment가 더 풍부한 쪽으로 합침
 * @param {...object[]} lists
 * @param {(p: object) => string} keyFn
 */
export function mergeCourseDiscoveryPlaces(keyFn, ...lists) {
  const byKey = new Map();
  const order = [];

  const richness = (p) => {
    let n = 0;
    if (p?.hasBlogEvidence || p?.blogInsight) n += 4;
    if (p?.isCuratorPick) n += 3;
    if (String(p?.comment || "").trim()) n += 2;
    if (Array.isArray(p?.tags) && p.tags.length) n += 1;
    return n;
  };

  for (const list of lists) {
    for (const raw of Array.isArray(list) ? list : []) {
      if (!raw || typeof raw !== "object") continue;
      const key = keyFn(raw);
      if (!key) continue;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, raw);
        order.push(key);
        continue;
      }
      // curator 우선 유지, blog는 보강
      let next = { ...prev };
      if (raw.isCuratorPick && !prev.isCuratorPick) {
        next = { ...raw, ...prev, isCuratorPick: true };
      }
      if (raw.blogInsight && !prev.blogInsight) {
        next = attachBlogInsightToCourseHit(next, raw);
      } else if (raw.comment && !String(prev.comment || "").trim()) {
        next = { ...next, comment: raw.comment };
      } else if (richness(raw) > richness(prev) && !prev.isCuratorPick) {
        next = attachBlogInsightToCourseHit(
          { ...raw, isCuratorPick: prev.isCuratorPick },
          raw
        );
      }
      byKey.set(key, next);
    }
  }

  return order.map((k) => byKey.get(k)).filter(Boolean);
}

/**
 * 블로그 근거 있는 후보를 앞에 두기 (AI가 근거 있는 집부터 보게)
 * @param {object[]} places
 */
export function rankCoursePlacesByDiscoveryEvidence(places) {
  return [...(Array.isArray(places) ? places : [])].sort((a, b) => {
    const score = (p) => {
      let s = 0;
      if (p?.isCuratorPick) s += 20;
      if (p?.hasBlogEvidence || p?.blogInsight) s += 12;
      if (String(p?.comment || "").trim().length > 20) s += 4;
      if (Array.isArray(p?.tags) && p.tags.length) s += Math.min(3, p.tags.length);
      return s;
    };
    return score(b) - score(a);
  });
}
