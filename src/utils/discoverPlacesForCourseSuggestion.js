/**
 * Studio AI 코스 후보 수집.
 * 본체: AI 검색어 계획 → 카카오·네이버·블로그(unified)로 장소 발굴 → 의도/권역 필터.
 */

import {
  courseSearchHitFromKakaoDocument,
  mapPlaceRowForCourse,
  mergeCourseSearchWithKakao,
  searchPlacesForCourse,
} from "../api/places";
import {
  filterPlacesForCourseSuggestionIntent,
  buildPartyCourseSearchPhrases,
} from "./filterPlacesForCourseSuggestionIntent.js";
import {
  filterPlacesForCourseArea,
  resolveCourseAreaPool,
} from "./generateCourseOptions.js";
import { parseCourseQuery } from "./parseCourseQuery.js";
import { fetchSearchIntentAssist } from "./searchAIAssistant.js";
import { fetchUnifiedMapSearch } from "./fetchUnifiedMapSearch.js";
import { placeKeyForCourseDraftAssist } from "./compactPlacesForCourseDraftAssist.js";
import { fetchPlacesForCuratorPage } from "./supabasePlaces.js";
import { queryWantsNopoFoodFocus } from "./searchParser.js";
import {
  attachBlogInsightToCourseHit,
  mergeCourseDiscoveryPlaces,
  planCoursePlaceSearchPhrases,
  rankCoursePlacesByDiscoveryEvidence,
} from "./coursePlaceDiscovery.js";

const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(
  /\/$/,
  ""
);

function unifiedPlaceToCourseHit(p) {
  if (!p || typeof p !== "object") return null;
  const lat = parseFloat(p.y);
  const lng = parseFloat(p.x);
  const kakaoId =
    p.kakao_place_id != null
      ? String(p.kakao_place_id).trim()
      : p.source === "kakao"
        ? String(p.id || "").trim()
        : "";
  let hit = null;
  if (/^\d+$/.test(kakaoId)) {
    hit = courseSearchHitFromKakaoDocument({
      id: kakaoId,
      place_name: p.place_name,
      y: p.y,
      x: p.x,
      category_name: p.category_name,
      road_address_name: p.road_address_name,
      address_name: p.address_name,
    });
  } else {
    const name = String(p.place_name || p.name || "").trim();
    if (!name) return null;
    hit = {
      id: String(p.id || name).trim(),
      name,
      address: String(
        p.road_address_name || p.address_name || p.address || ""
      ).trim(),
      category: String(p.category_name || p.category || "").trim(),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  }
  return attachBlogInsightToCourseHit(hit, p);
}

function mergePlaceLists(...lists) {
  return mergeCourseDiscoveryPlaces(placeKeyForCourseDraftAssist, ...lists);
}

async function boostCourseAreaPlaces(trimmed, parsed, merged) {
  const area = String(parsed?.area || "").trim();
  if (!area) return merged;

  let pool = resolveCourseAreaPool(merged, parsed).areaPlaces;
  if (pool.length >= 10) return pool;

  const wantsNopo = queryWantsNopoFoodFocus(trimmed, null);
  const neighborhoodBoost = {
    충무로: wantsNopo
      ? [
          "충무로역 노포",
          "충무로역 포차",
          "필동 노포",
          "필동 포차",
          "필동 막걸리",
          "인현동 포차",
          "초동 포차",
          "예장동 포차",
          "충무로 막걸리",
          "충무로 선술집",
        ]
      : [
          "충무로역 술집",
          "필동 술집",
          "인현동 술집",
          "초동 술집",
          "예장동 술집",
        ],
  };
  const boostPhrases = [
    ...(neighborhoodBoost[area] || []),
    ...(wantsNopo
      ? [
          ...buildPartyCourseSearchPhrases(trimmed, parsed),
          `${area} 노포`,
          `${area} 포차`,
          `${area} 막걸리`,
          `${area} 선술집`,
          `${area} 골목 포차`,
        ]
      : [
          ...buildPartyCourseSearchPhrases(trimmed, parsed),
          `${area} 술집`,
          `${area} 맛집`,
          `${area} 바`,
          `${area} ${trimmed.split(/\s+/)[0] || area}`,
        ]),
  ];
  const seenPhrase = new Set();
  for (const phrase of boostPhrases) {
    const p = String(phrase || "").trim();
    if (p.length < 2 || seenPhrase.has(p.toLowerCase())) continue;
    seenPhrase.add(p.toLowerCase());
    const extra = await mergeCourseSearchWithKakao([], p, {
      maxTotal: 14,
      kakaoSize: 10,
    });
    merged = mergePlaceLists(merged, extra);
    pool = resolveCourseAreaPool(merged, parsed).areaPlaces;
    if (pool.length >= 12) break;
  }

  return pool.length > 0 ? pool : merged;
}

function assignPopularityRanks(places) {
  let rank = 0;
  return (Array.isArray(places) ? places : []).map((p) => {
    if (!p || typeof p !== "object" || p.isCuratorPick) return p;
    if (p._popularityRank != null) return p;
    return { ...p, _popularityRank: rank++ };
  });
}

async function fetchCuratorPickHits(curatorUserId, parsed) {
  const uid = String(curatorUserId || "").trim();
  if (!uid) return [];
  try {
    const rows = await fetchPlacesForCuratorPage({ user_id: uid });
    let hits = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const mapped = mapPlaceRowForCourse(row);
        if (!mapped.id) return null;
        const noteParts = [
          row.comment,
          row.one_line_reason,
          row.one_line_review,
          row.menu_reason,
        ]
          .map((v) => String(v ?? "").trim())
          .filter(Boolean);
        return {
          ...mapped,
          isCuratorPick: true,
          comment: [...new Set(noteParts)].join(" · "),
          one_line_reason: row.one_line_reason ?? null,
          one_line_review: row.one_line_review ?? null,
          menu_reason: row.menu_reason ?? null,
        };
      })
      .filter(Boolean);
    if (parsed?.area) {
      const areaFiltered = filterPlacesForCourseArea(hits, parsed.area);
      if (areaFiltered.length >= 1) hits = areaFiltered;
    }
    return hits;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[discoverPlacesForCourseSuggestion] curator picks", e);
    }
    return [];
  }
}

/**
 * AI 검색어 계획 → 카카오·네이버·블로그로 장소 발굴 (본체)
 */
async function discoverPlacesViaUnifiedSearch(trimmed, searchPhrases, onPhase) {
  onPhase("지도·블로그에서 장소 찾는 중…");
  try {
    const unified = await fetchUnifiedMapSearch(
      {
        query: trimmed,
        searchPhrases: searchPhrases.slice(0, 8),
        includeBlog: true,
        blogTimeoutMs: 16000,
      },
      AI_API_BASE
    );
    const extras = (Array.isArray(unified?.places) ? unified.places : [])
      .map(unifiedPlaceToCourseHit)
      .filter(Boolean);
    return {
      places: extras,
      blogOk: unified?.meta?.blogOk === true,
      blogInsightPlaces: Number(unified?.meta?.blogInsightPlaces) || 0,
    };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[discoverPlacesForCourseSuggestion] unified", e);
    }
    return { places: [], blogOk: false, blogInsightPlaces: 0 };
  }
}

/**
 * 검색어 기준 후보 장소 수집 — AI 발굴 본체 + DB/카카오 보강 + 의도 필터.
 * @param {string} query
 * @param {{ onPhase?: (msg: string) => void, curatorUserId?: string }} [opts]
 */
export async function discoverPlacesForCourseSuggestion(query, opts = {}) {
  const trimmed = String(query || "").replace(/\s+/g, " ").trim();
  if (trimmed.length < 2) {
    throw new Error("검색어를 2글자 이상 입력해 주세요.");
  }

  const onPhase = typeof opts.onPhase === "function" ? opts.onPhase : () => {};
  const parsed = parseCourseQuery(trimmed, { forAiCourseDraft: true });

  onPhase("검색 의도 파악 중…");
  let intentAssist = null;
  try {
    intentAssist = await fetchSearchIntentAssist(trimmed);
  } catch {
    /* optional */
  }

  const searchPhrases = planCoursePlaceSearchPhrases(
    trimmed,
    parsed,
    intentAssist
  );

  // 1) 본체: 카카오 + 네이버 + 블로그 (홈 통합 검색과 동일 파이프)
  const unifiedResult = await discoverPlacesViaUnifiedSearch(
    trimmed,
    searchPhrases,
    onPhase
  );
  let merged = unifiedResult.places;

  // 2) DB·카카오 키워드 보강 (잔 DB / 누락 POI)
  onPhase("장소 후보 보강 중…");
  const dbHits = await searchPlacesForCourse(trimmed, { limit: 32 });
  const kakaoPrimary = await mergeCourseSearchWithKakao(dbHits, trimmed, {
    maxTotal: 36,
    kakaoSize: 15,
  });
  merged = mergePlaceLists(merged, kakaoPrimary);

  for (const phrase of searchPhrases.slice(0, 6)) {
    if (phrase === trimmed) continue;
    const extra = await mergeCourseSearchWithKakao([], phrase, {
      maxTotal: 12,
      kakaoSize: 8,
    });
    merged = mergePlaceLists(merged, extra);
    if (merged.length >= 40) break;
  }

  merged = await boostCourseAreaPlaces(trimmed, parsed, merged);

  const curatorUserId = String(opts.curatorUserId || "").trim();
  if (curatorUserId) {
    onPhase("잔 리스트 불러오는 중…");
    const curatorHits = await fetchCuratorPickHits(curatorUserId, parsed);
    if (curatorHits.length) {
      merged = mergePlaceLists(curatorHits, merged);
      if (parsed?.area) {
        const inArea = filterPlacesForCourseArea(merged, parsed.area);
        if (inArea.length > 0) merged = inArea;
      }
    }
  }

  merged = rankCoursePlacesByDiscoveryEvidence(merged);
  merged = assignPopularityRanks(merged);
  const minNeed = Math.max(2, parsed?.stopTarget?.min || 2);
  const wantsNopo = queryWantsNopoFoodFocus(trimmed, null);

  let intentMerged = filterPlacesForCourseSuggestionIntent(trimmed, merged, {
    minKeep: 20,
    minAbsolute: minNeed,
    nopoWidePool: wantsNopo,
  });
  if (intentMerged.length < minNeed) {
    merged = await boostCourseAreaPlaces(trimmed, parsed, merged);
    intentMerged = filterPlacesForCourseSuggestionIntent(trimmed, merged, {
      minKeep: 20,
      minAbsolute: minNeed,
      nopoSoftFallback: wantsNopo,
      nopoWidePool: wantsNopo,
    });
  }
  if (wantsNopo) {
    merged = intentMerged;
  } else if (intentMerged.length >= minNeed) {
    merged = intentMerged;
  }

  if (parsed?.area) {
    let inArea = filterPlacesForCourseArea(merged, parsed.area);
    if (inArea.length < minNeed) {
      merged = await boostCourseAreaPlaces(trimmed, parsed, merged);
      intentMerged = filterPlacesForCourseSuggestionIntent(trimmed, merged, {
        minKeep: 20,
        minAbsolute: minNeed,
        nopoSoftFallback: wantsNopo,
        nopoWidePool: wantsNopo,
      });
      if (wantsNopo || intentMerged.length >= minNeed) {
        merged = intentMerged;
      }
      inArea = filterPlacesForCourseArea(merged, parsed.area);
    }
    if (inArea.length > 0) {
      merged = inArea;
    }
  }

  if (wantsNopo) {
    // 최종에서도 wide — 강한 노포만 남기면 6곳만 돌려쓰기 됨
    merged = filterPlacesForCourseSuggestionIntent(trimmed, merged, {
      minKeep: 24,
      minAbsolute: Math.min(minNeed, 2),
      nopoWidePool: true,
    });
  } else {
    merged = rankCoursePlacesByDiscoveryEvidence(merged);
  }

  if (merged.length < minNeed) {
    const need = parsed?.stopTarget?.exact
      ? `${parsed.stopTarget.target}곳`
      : "2곳";
    const areaHint = parsed?.area
      ? ` '${parsed.area}' 일대 후보가 부족해요.`
      : "";
    const nopoHint = wantsNopo
      ? " 노포 신호가 있는 장소가 더 필요해요."
      : "";
    throw new Error(
      `${need} 코스를 만들 후보가 부족해요.${areaHint}${nopoHint} 지역·테마를 검색어에 넣거나, 장소를 잔 리스트에 올려 보세요.`
    );
  }

  const curatorPickCount = curatorUserId
    ? merged.filter((p) => p?.isCuratorPick).length
    : 0;
  const blogEvidenceCount = merged.filter(
    (p) => p?.hasBlogEvidence || p?.blogInsight
  ).length;

  return {
    parsed,
    places: merged.slice(0, 28),
    curatorPickCount,
    discoveryMeta: {
      searchPhrases,
      blogOk: unifiedResult.blogOk,
      blogInsightPlaces: unifiedResult.blogInsightPlaces,
      blogEvidenceCount,
    },
  };
}
