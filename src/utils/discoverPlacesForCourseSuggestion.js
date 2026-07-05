import {
  courseSearchHitFromKakaoDocument,
  mapPlaceRowForCourse,
  mergeCourseSearchWithKakao,
  searchPlacesForCourse,
} from "../api/places";
import {
  filterPlacesForCourseSuggestionIntent,
  refineSearchPhrasesForCourseIntent,
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
  if (/^\d+$/.test(kakaoId)) {
    return courseSearchHitFromKakaoDocument({
      id: kakaoId,
      place_name: p.place_name,
      y: p.y,
      x: p.x,
      category_name: p.category_name,
      road_address_name: p.road_address_name,
      address_name: p.address_name,
    });
  }
  const name = String(p.place_name || p.name || "").trim();
  if (!name) return null;
  return {
    id: String(p.id || name).trim(),
    name,
    address: String(p.road_address_name || p.address_name || p.address || "").trim(),
    category: String(p.category_name || p.category || "").trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function mergePlaceLists(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const raw of Array.isArray(list) ? list : []) {
      const p =
        raw && typeof raw === "object" && raw.name != null
          ? raw
          : mapPlaceRowForCourse(raw);
      const key = placeKeyForCourseDraftAssist(p);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

async function boostCourseAreaPlaces(trimmed, parsed, merged) {
  const area = String(parsed?.area || "").trim();
  if (!area) return merged;

  let pool = resolveCourseAreaPool(merged, parsed).areaPlaces;
  if (pool.length >= 10) return pool;

  const boostPhrases = [
    ...buildPartyCourseSearchPhrases(trimmed, parsed),
    `${area} 술집`,
    `${area} 맛집`,
    `${area} 바`,
    `${area} ${trimmed.split(/\s+/)[0] || area}`,
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
 * 검색어 기준 후보 장소 수집 — DB + 카카오 + (부족 시) 통합 지도 검색.
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

  onPhase("장소 후보 수집 중…");

  let searchPhrases = [trimmed];
  try {
    const intent = await fetchSearchIntentAssist(trimmed);
    const broad = String(intent?.broadKakaoKeyword || "").trim();
    const hint = String(intent?.kakaoKeywordHint || "").trim();
    if (broad) searchPhrases.push(broad);
    if (hint && hint !== broad && hint !== trimmed) searchPhrases.push(hint);
  } catch {
    /* optional */
  }
  searchPhrases = refineSearchPhrasesForCourseIntent(
    trimmed,
    searchPhrases,
    parsed
  );

  const dbHits = await searchPlacesForCourse(trimmed, { limit: 32 });
  let merged = await mergeCourseSearchWithKakao(dbHits, trimmed, {
    maxTotal: 36,
    kakaoSize: 15,
  });

  for (const phrase of searchPhrases.slice(1, 4)) {
    if (phrase === trimmed) continue;
    const extra = await mergeCourseSearchWithKakao([], phrase, {
      maxTotal: 12,
      kakaoSize: 8,
    });
    merged = mergePlaceLists(merged, extra);
    if (merged.length >= 24) break;
  }

  if (merged.length < 10) {
    try {
      const unified = await fetchUnifiedMapSearch(
        {
          query: trimmed,
          searchPhrases: searchPhrases.slice(0, 6),
          includeBlog: false,
        },
        AI_API_BASE
      );
      const extras = (Array.isArray(unified?.places) ? unified.places : [])
        .map(unifiedPlaceToCourseHit)
        .filter(Boolean);
      merged = mergePlaceLists(merged, extras);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[discoverPlacesForCourseSuggestion] unified", e);
      }
    }
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
        if (inArea.length >= 2) merged = inArea;
      }
    }
  }

  merged = assignPopularityRanks(merged);
  merged = filterPlacesForCourseSuggestionIntent(trimmed, merged);

  if (parsed?.area) {
    const inArea = filterPlacesForCourseArea(merged, parsed.area);
    if (inArea.length >= 2) {
      merged = inArea;
    } else if (inArea.length > 0) {
      merged = inArea;
    }
  }

  if (merged.length < Math.max(2, parsed?.stopTarget?.min || 2)) {
    const need = parsed?.stopTarget?.exact
      ? `${parsed.stopTarget.target}곳`
      : "2곳";
    const areaHint = parsed?.area
      ? ` '${parsed.area}' 일대 후보가 부족해요.`
      : "";
    throw new Error(
      `${need} 코스를 만들 후보가 부족해요.${areaHint} 지역·테마를 검색어에 넣거나, 장소를 먼저 DB에 등록해 보세요.`
    );
  }

  const curatorPickCount = curatorUserId
    ? merged.filter((p) => p?.isCuratorPick).length
    : 0;

  return {
    parsed,
    places: merged.slice(0, 28),
    curatorPickCount,
  };
}
