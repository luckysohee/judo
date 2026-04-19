import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/Toast/ToastProvider";

import MarkerLegend from "../../components/Map/MarkerLegend";
import SearchBar from "../../components/SearchBar/SearchBar";
import CuratorFilterBar from "../../components/CuratorFilterBar/CuratorFilterBar";
import CuratorApplicationButton from "../../components/CuratorApplicationButton/CuratorApplicationButton";
import UserCard from "../../components/UserCard/UserCard";
import MapView from "../../components/Map/MapView";
import PlacePreviewCard from "../../components/PlaceCard/PlacePreviewCard";
import PlaceDetail from "../../components/PlaceDetail/PlaceDetail";
import SaveFolderModal from "../../components/SaveFolderModal/SaveFolderModal";
import SavedPlaces from "../../components/SavedPlaces/SavedPlaces";
import AddPlaceForm from "../../components/AddPlaceForm/AddPlaceForm";
import AnimatedToast from "../../components/AnimatedToast/AnimatedToast";
import CheckinRanking from "../../components/CheckinRanking/CheckinRanking";
import HotPlaceMarker from "../../components/HotPlaceMarker/HotPlaceMarker";
import CheckInToast from "../../components/CheckInToast/CheckInToast";
import FeatureLoginPrompt from "../../components/LoginPrompt/FeatureLoginPrompt";

import { places as dummyPlaces } from "../../data/places";

import { useAuth } from "../../context/AuthContext";

import { supabase } from "../../lib/supabase";
import { syncAuthProviderToProfile } from "../../lib/syncAuthProviderToProfile";

import {
  getFolders,
  getSavedPlacesMap,
  getPlaceFolderIds,
  getPrimarySavedFolderColor,
  isPlaceSaved,
  savePlaceToFolder,
} from "../../utils/storage";

import { getCustomPlaces } from "../../utils/customPlacesStorage";
import { curatorPlaceMatchesLoggedInCurator } from "../../utils/curatorPlacesIdentity";
import { mapClickCoordToPreviewPlace } from "../../utils/mapClickCoordToPreviewPlace";
import {
  resolveMapClickVenue,
  kakaoPlacesDocToMapClickPreview,
} from "../../utils/resolveMapClickVenue";
import parseNaturalQuery from "../../utils/parseNaturalQuery";
import {
  parseSearchQuery,
  scorePlace,
  matchedQueryFacetLabels,
  representativePlaceTag,
  parsePartySize,
  findAreaKeywordInQuery,
  extractLocationAnchorFromQuery,
  shouldKeepExtractedLocationForMapSearch,
  isSimpleLocationMenuMapQuery,
  isLikelyNaturalLanguageSearchQuery,
  isMapGeographicPanOnlyQuery,
  getKakaoKeywordSuffix,
  stripPartyAndChatterForKeywordSearch,
  lockKeywordToClientForKakaoHint,
  filterPlacesByParsedIntent,
  buildRecommendationWhyLine,
  expandFoodKakaoQueries,
  kakaoQueryHasGeographicAnchor,
  queryWantsSeafoodFocus,
  isObviousNonSeafoodKakaoPlace,
  queryWantsYajangFocus,
  YAJANG_PLACE_HINT_RE,
  placeSignalsYajangCuratorMeta,
} from "../../utils/searchParser";
import { buildCuratorSearchHighlights } from "../../utils/searchCuratorHighlights";
import { getSearchLoadingMessage } from "../../utils/searchLoadingMessage";
import { fetchSearchIntentAssist } from "../../utils/searchAIAssistant";
import { buildExpansionSuggestions } from "../../utils/searchExpansionSuggestions";
import { insertSearchLog, insertPlaceClickLog } from "../../utils/searchAnalytics";
import CuratorPicksStrip from "../../components/Home/CuratorPicksStrip";
import HotCheckinStrip from "../../components/Home/HotCheckinStrip";
import { fetchUnifiedMapSearch } from "../../utils/fetchUnifiedMapSearch";
import { mergeIntentAssistIntoSearchPhrases } from "../../utils/mergeIntentAssistSearchPhrases";
import {
  fetchCuratorPlaceDbSearch,
  mergeDbPlaceIdsFirst,
} from "../../utils/fetchCuratorPlaceDbSearch";
import {
  resolvePlaceWgs84,
  haversineMeters,
  kakaoNumericPlaceId,
  isLikelyKoreaWgs84,
} from "../../utils/placeCoords";
import { buildFormattedPlacesFromJoin } from "../../utils/buildFormattedPlacesFromJoin";
import {
  fetchCuratorPlaceRowsInBounds,
  padLatLngBounds,
  filterJoinRowsToBounds,
} from "../../utils/fetchCuratorPlacesInBounds";
import { debounce } from "../../utils/debounce";
import { fetchPlaceDetail } from "../../api/places";
import {
  isWalkingRouteReasonable,
  walkingRouteDisplayMinutes,
} from "../../utils/courseWalkingRouteQuality.js";
import {
  getKakaoPlaceDetailsViaProxy,
  searchKakaoKeywordViaProxy,
  searchKakaoAddressViaProxy,
} from "../../utils/kakaoAPIProxy";
import {
  mergePickedPlaceWithCuratorCatalog,
  findCuratorCatalogMatch,
  dedupeMapPlacesByKakaoId,
  normalizeKakaoPlaceId,
} from "../../utils/mergePickedPlaceWithCuratorCatalog";
import { applyYajangCuratorFallbackIfEmpty } from "../../utils/curatorYajangFallback";
import { filterPlaceTagsForDisplay } from "../../utils/placeUiTags";
import { saveUserPreferences, getUserPreferences, hasCompletedOnboarding } from "../../utils/userPreferences";
import { useLoginRequired } from "../../hooks/useLoginRequired";
import { useCourseSearch } from "../../hooks/useCourseSearch";
import { useRealtimeCheckins } from "../../hooks/useRealtimeCheckins";
import { getMarkerTier, isCuratorListedPlace } from "../../utils/createMarker";
import { isCourseQuery } from "../../utils/isCourseQuery";
import {
  formatCourseStayMinutes,
  formatCourseWalkApprox,
  getCourseOpenStatusText,
  getCourseWalkComfortHint,
  getCourseLegMeters,
  formatCourseLegDistanceSummary,
} from "../../utils/formatCourseUi";
import { fetchCourseWalkingRoute } from "../../utils/fetchCourseWalkingRoute.js";
import { fetchRegionOutline } from "../../utils/fetchRegionOutline.js";
import { getRegenerateSecondLabel } from "../../utils/regenerateSecondStep.js";
import { buildCourseSummary } from "../../utils/buildCourseSummary";
import { buildCourseMapData } from "../../utils/buildCourseMapData";
import {
  courseOptionsToMapPlaces,
  courseSecondCandidatesToPulseMapPlaces,
  placeId,
} from "../../utils/generateCourseOptions.js";
import {
  COURSE_SECOND_SNACK_OPTIONS,
  STUDIO_ATMOSPHERE_OPTIONS,
  STUDIO_LIQUOR_TYPE_OPTIONS,
} from "../../utils/placeTaxonomy.js";

/** 지도 「2차 찾기」— 1차 기준 후보·카카오 검색 반경 상한 */
const COURSE_SECOND_FIND_DISTANCE_OPTIONS = [
  { m: 1000, label: "1km 안쪽" },
  { m: 3000, label: "3km 안" },
  { m: 5000, label: "5km 안" },
];
import { snapshotFromMyOwnCourse } from "../../utils/savedMyCoursesStorage.js";
import {
  fetchMySavedCoursePairKeys,
  insertSavedMyCourse,
} from "../../utils/savedMyCoursesSupabase.js";
import {
  addLegacyPlaceCuratorAliasesToKeySet,
  addLegacyPlaceCuratorIdsForUsername,
  addLegacyPlaceCuratorIdsForCuratorProfile,
  expandLegacyPlaceCuratorIdIfAny,
  legacyCompactUuidToDashed,
  legacyPlaceCuratorIdCompactsForProfile,
} from "../../utils/curatorLegacyPlaceIds";

// 비우면 `/api/*` 상대 경로 → Vite proxy → server:4000
const AI_API_BASE = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(/\/$/, "");

/** 우측 마커 안내(단일·공동·프리미엄) 선택 시 지도에 표시할 장소만 남김 */
function applyLegendCategoryFilter(places, legendCategory) {
  if (!legendCategory || !Array.isArray(places)) return places;

  if (
    legendCategory === "basic" ||
    legendCategory === "hot" ||
    legendCategory === "premium"
  ) {
    return places.filter((p) => {
      if (!isCuratorListedPlace(p)) return false;
      return getMarkerTier(p).level === legendCategory;
    });
  }

  return places;
}

/**
 * 미리보기 카드로 연 장소가 `mapDisplayedPlacesWithLegend`에서 빠지면 핀이 안 보임.
 * (큐레이터 전용 핀 모드에서 kPins를 비움, 범례가 큐레이터 등급만 표시 등)
 */
function selectedVenuePinAlreadyOnMap(places, selectedPlace) {
  if (!selectedPlace || !Array.isArray(places)) return true;
  const wSel = resolvePlaceWgs84(selectedPlace);
  if (!wSel) return false;
  const selId = selectedPlace.id != null ? String(selectedPlace.id) : "";
  const selKid = normalizeKakaoPlaceId(selectedPlace);
  return places.some((p) => {
    if (selId && String(p?.id ?? "") === selId) {
      const w = resolvePlaceWgs84(p);
      return Boolean(w && isLikelyKoreaWgs84(w.lat, w.lng));
    }
    const pk = normalizeKakaoPlaceId(p);
    if (!selKid || !pk || selKid !== pk) return false;
    const w = resolvePlaceWgs84(p);
    return Boolean(w && isLikelyKoreaWgs84(w.lat, w.lng));
  });
}

function appendSelectedPlacePinIfMissing(places, selectedPlace) {
  if (!selectedPlace || !Array.isArray(places)) return places;
  const w = resolvePlaceWgs84(selectedPlace);
  if (!w) return places;
  const geoOk = isLikelyKoreaWgs84(w.lat, w.lng);
  if (!geoOk && !(Number.isFinite(w.lat) && Number.isFinite(w.lng))) {
    return places;
  }
  if (selectedVenuePinAlreadyOnMap(places, selectedPlace)) return places;
  return [
    {
      ...selectedPlace,
      lat: w.lat,
      lng: w.lng,
      x: String(w.lng),
      y: String(w.lat),
    },
    ...places,
  ];
}

/** DB `places` 상세 fetch 결과를 미리보기 객체에 합침 — 큐레이터 집계 필드는 유지 */
function mergeDbPlaceDetailForPreview(prev, detail) {
  if (!prev || !detail || typeof detail !== "object") return prev;
  return {
    ...prev,
    ...detail,
    curatorPlaces: prev.curatorPlaces,
    curatorCount: prev.curatorCount,
    curatorReasons: prev.curatorReasons,
    curatorUsernames: prev.curatorUsernames,
    curators: prev.curators,
    tags:
      Array.isArray(prev.tags) && prev.tags.length > 0
        ? prev.tags
        : Array.isArray(detail.tags)
          ? detail.tags
          : prev.tags,
    moods:
      Array.isArray(prev.moods) && prev.moods.length > 0
        ? prev.moods
        : detail.moods ?? prev.moods,
    vibes:
      Array.isArray(prev.vibes) && prev.vibes.length > 0
        ? prev.vibes
        : detail.vibes ?? prev.vibes,
    is_public: prev.is_public,
  };
}

/**
 * 장소에 붙은 추천(curator_places) ↔ 칩 키(username·display_name·auth uid) 교차 매칭.
 * curator_id 는 curators.user_id — PostgREST FK 임베드 대신 attachCuratorsToCuratorPlaceRows 로 보강.
 */
function collapseCuratorMatchToken(s) {
  return String(s ?? "")
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, "");
}

function buildPlaceCuratorFilterKeySet(place, dbCurators) {
  const keys = new Set();
  const add = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return;
    keys.add(s);
    const collapsed = collapseCuratorMatchToken(s);
    if (collapsed && collapsed !== s) keys.add(collapsed);
  };
  for (const v of place.curatorUsernames || []) add(v);
  for (const v of place.curators || []) add(v);
  for (const cp of place.curatorPlaces || []) {
    add(cp.curator_id);
    add(cp.curators?.username);
    add(cp.curators?.display_name);
    add(cp.curators?.user_id);
    add(cp.curators?.id);
  }
  if (Array.isArray(dbCurators) && dbCurators.length > 0) {
    for (const cp of place.curatorPlaces || []) {
      const cid = String(cp.curator_id ?? "").trim().toLowerCase();
      if (!cid) continue;
      for (const c of dbCurators) {
        const rowUid = String(c.userId ?? "").trim().toLowerCase();
        const rowPk = String(c.id ?? "").trim().toLowerCase();
        if ((rowUid && rowUid === cid) || (rowPk && rowPk === cid)) {
          add(c.username);
          add(c.displayName);
          add(c.filterKey);
          add(c.name);
          add(c.slug);
          add(c.id);
          if (rowUid) add(rowUid);
        }
      }
    }
  }
  addLegacyPlaceCuratorAliasesToKeySet(keys);
  return keys;
}

/** 칩에서 넘긴 문자열(@제거·소문자)을 dbCurators 행의 모든 별칭으로 확장 */
function expandCuratorChipSelectionKeys(raw, dbCurators) {
  const sel = String(raw ?? "")
    .trim()
    .replace(/^@+/u, "")
    .toLowerCase();
  const out = new Set();
  if (!sel) return out;
  out.add(sel);
  const selCollapsed = collapseCuratorMatchToken(sel);
  if (selCollapsed && selCollapsed !== sel) out.add(selCollapsed);
  expandLegacyPlaceCuratorIdIfAny(sel, (x) => out.add(x));
  addLegacyPlaceCuratorIdsForUsername(sel, (x) => out.add(x));
  if (selCollapsed && selCollapsed !== sel) {
    addLegacyPlaceCuratorIdsForUsername(selCollapsed, (x) => out.add(x));
  }
  for (const c of dbCurators || []) {
    const aliases = [
      c.username,
      c.displayName,
      c.name,
      c.filterKey,
      c.slug,
      c.id,
      c.userId,
    ]
      .map((x) =>
        String(x ?? "")
          .trim()
          .replace(/^@+/u, "")
          .toLowerCase()
      )
      .filter(Boolean);
    const aliasMatch = new Set(aliases);
    for (const a of aliases) {
      const ac = collapseCuratorMatchToken(a);
      if (ac) aliasMatch.add(ac);
    }
    if (!aliasMatch.has(sel) && !aliasMatch.has(selCollapsed)) continue;
    aliases.forEach((a) => {
      out.add(a);
      const ac = collapseCuratorMatchToken(a);
      if (ac) out.add(ac);
    });
    const handleLc =
      String(c.username ?? "")
        .trim()
        .toLowerCase()
        .replace(/^@+/u, "") ||
      String(c.slug ?? "")
        .trim()
        .toLowerCase()
        .replace(/^@+/u, "") ||
      String(c.filterKey ?? "")
        .trim()
        .toLowerCase()
        .replace(/^@+/u, "");
    if (handleLc) {
      addLegacyPlaceCuratorIdsForUsername(handleLc, (x) => out.add(x));
    }
    addLegacyPlaceCuratorIdsForCuratorProfile(c, (x) => out.add(x));
  }
  return out;
}

/**
 * PostgREST 임베드가 «칩·필터에 쓸 표시명/핸들»까지 있는지.
 * id·user_id 만 오고 username/display_name 이 비는 경우가 있어, 그때는 attach 로 덮어쓴다.
 */
function curatorJoinRowLooksComplete(c) {
  if (c == null) return false;
  if (Array.isArray(c)) {
    if (c.length === 0) return false;
    return curatorJoinRowLooksComplete(c[0]);
  }
  if (typeof c !== "object") return false;
  const u = c.username != null ? String(c.username).trim() : "";
  const d = c.display_name != null ? String(c.display_name).trim() : "";
  return Boolean(u || d);
}

/**
 * curator_places.curator_id (= curators.user_id) 로 curators 행을 붙임 (임베드 없이).
 */
function attachCuratorsToCuratorPlaceRows(rows, curatorRows) {
  const map = new Map();
  for (const c of curatorRows || []) {
    const uid = String(c.user_id ?? "").trim().toLowerCase();
    const pk = String(c.id ?? "").trim().toLowerCase();
    if (uid) map.set(uid, c);
    if (pk) map.set(pk, c);
    for (const lc of legacyPlaceCuratorIdCompactsForProfile(c)) {
      const dashed = legacyCompactUuidToDashed(lc);
      if (!dashed) continue;
      map.set(dashed, c);
      map.set(lc, c);
    }
  }
  return (rows || []).map((row) => {
    const key = String(row?.curator_id ?? "").trim().toLowerCase();
    const compact = key.replace(/-/g, "");
    const hit = key
      ? map.get(key) || (compact ? map.get(compact) : null)
      : null;
    if (!hit) return row;
    if (curatorJoinRowLooksComplete(row?.curators)) return row;
    return { ...row, curators: hit };
  });
}

/** 칩 문자열·uuid → `dbCurators` 포맷 행 한 개 (필터 구조 보강용) */
function findDbCuratorRowForChip(rawSel, dbCurators) {
  const raw = String(rawSel ?? "").trim();
  if (!raw) return null;
  const selLower = raw.toLowerCase();
  const selCollapsed = collapseCuratorMatchToken(raw);
  for (const c of dbCurators || []) {
    const parts = [
      c.username,
      c.displayName,
      c.name,
      c.filterKey,
      c.slug,
      c.id != null ? String(c.id).trim() : "",
      c.userId != null ? String(c.userId).trim() : "",
    ].filter(Boolean);
    for (const p of parts) {
      const pl = String(p).trim().toLowerCase();
      if (pl === selLower) return c;
      if (collapseCuratorMatchToken(p) === selCollapsed) return c;
    }
  }
  const compact = selLower.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/.test(compact)) {
    for (const c of dbCurators || []) {
      const idc = String(c.id ?? "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "");
      const uidc = String(c.userId ?? "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "");
      if (idc && idc === compact) return c;
      if (uidc && uidc === compact) return c;
    }
  }
  return null;
}

/** `curator_places.curator_id`(= user_id) 와 직접 비교할 auth·프로필 uuid 집합 */
function collectCuratorIdsForRescueMatch(c) {
  const s = new Set();
  const add = (v) => {
    const t = String(v ?? "").trim().toLowerCase();
    if (!t) return;
    s.add(t);
    s.add(t.replace(/-/g, ""));
  };
  if (!c) return s;
  add(c.userId);
  const profile = {
    username: c.username,
    display_name: c.displayName,
    displayName: c.displayName,
    name: c.name,
    slug: c.slug,
    filterKey: c.filterKey,
  };
  for (const lc of legacyPlaceCuratorIdCompactsForProfile(profile)) {
    add(lc);
    const dashed = legacyCompactUuidToDashed(lc);
    if (dashed) add(dashed);
  }
  return s;
}

/**
 * 칩에서 넘긴 값을 curator_places.curator_id(= curators.user_id) 기준으로 정규화한다.
 */
function canonicalCuratorChipToken(key, dbCurators) {
  const k = String(key ?? "").trim();
  if (!k) return "";
  const kLower = k.toLowerCase();
  const kNorm = kLower.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/.test(kNorm)) {
    for (const c of dbCurators || []) {
      for (const idf of [c.userId, c.id]) {
        const t = String(idf ?? "")
          .trim()
          .toLowerCase()
          .replace(/-/g, "");
        if (t && t === kNorm) {
          return String(c.userId || c.id || k).trim();
        }
      }
    }
  }
  const kColl = collapseCuratorMatchToken(k);
  for (const c of dbCurators || []) {
    const candidates = [
      c.filterKey,
      c.username,
      c.displayName,
      c.name,
      c.slug,
      c.id != null ? String(c.id) : "",
      c.userId != null ? String(c.userId) : "",
    ]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
    for (const t of candidates) {
      if (t.toLowerCase() === kLower) {
        return String(c.userId || c.id || k).trim();
      }
      if (collapseCuratorMatchToken(t) === kColl) {
        return String(c.userId || c.id || k).trim();
      }
    }
  }
  return k;
}

/** localStorage(savedMap) + Supabase(user_saved_places → userSavedPlaces) 저장 키 합집합 */
function buildMergedSavedPlaceKeySet(savedMap, userSavedPlaces) {
  const set = new Set();
  if (savedMap && typeof savedMap === "object") {
    for (const [placeId, folderIds] of Object.entries(savedMap)) {
      if (Array.isArray(folderIds) && folderIds.length > 0) {
        set.add(String(placeId));
      }
    }
  }
  if (userSavedPlaces && typeof userSavedPlaces === "object") {
    for (const [placeId, folders] of Object.entries(userSavedPlaces)) {
      if (Array.isArray(folders) && folders.length > 0) {
        set.add(String(placeId));
      }
    }
  }
  return set;
}

/** 미리보기 카드와 동일하게 UUID·카카오 id 등으로 저장 키와 매칭 */
function placeMatchesSavedKeySet(place, savedKeySet) {
  if (!place || !savedKeySet?.size) return false;
  const keys = [place.id, place.place_id, place.kakao_place_id, place.kakaoId]
    .filter((x) => x != null && x !== "")
    .map((x) => String(x));
  return keys.some((k) => savedKeySet.has(k));
}

const SEARCH_INTENT_ASSIST_MS = 5500;

/** 코스 카드 가로 스크롤 행 — 뷰 중앙에 가장 가까운 카드 인덱스 */
function getCourseSwipeIndexFromScroll(el) {
  if (!el || el.children.length === 0) return 0;
  const host = el.getBoundingClientRect();
  const midX = host.left + host.width / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < el.children.length; i++) {
    const cr = el.children[i].getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const d = Math.abs(cx - midX);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export default function Home() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const { showToast } = useToast();

  const { user, loading: authLoading, signInWithProvider, signOut } = useAuth();

  const devAdminUserId = import.meta.env.VITE_ADMIN_USER_ID;

  // 팔로우 알림 확인 함수
  const checkUnreadFollowers = async (curatorId) => {
    // 테이블이 존재하지 않으므로 바로 종료
    console.log('ℹ️ follower_notifications 테이블이 존재하지 않아 팔로우 알림 확인을 건너뜁니다.');
    return;
    
    try {
      // 테이블이 존재하는지 확인 후 쿼리 실행
      const { data, error } = await supabase
        .from('follower_notifications')
        .select('*')
        .eq('curator_id', curatorId)
        .eq('is_read', false);

      if (error) {
        // 테이블이 없는 경우 에러를 무시하고 로그만 남김
        if (error.code === 'PGRST205') {
          console.log('ℹ️ follower_notifications 테이블이 존재하지 않습니다.');
          return;
        }
        console.error('팔로우 알림 확인 오류:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log(`🔔 새로운 팔로워 ${data.length}명이 있습니다!`);
        // 여기에 알림 표시 로직 추가
      }
    } catch (error) {
      console.error('팔로우 알림 확인 중 오류:', error);
    }
  };

  // 로컬 AI 검색 함수들
  const getCurrentUserLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation이 지원되지 않습니다.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error('위치 가져오기 실패:', error);
          // 기본 위치: 서울 시청
          resolve({ lat: 37.5665, lng: 126.9780 });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 300000 // 5분 캐시
        }
      );
    });
  };

  const searchNearbyBars = async (keyword, userLocation) => {
    return new Promise((resolve) => {
      if (!window.kakao?.maps?.services) {
        resolve([]);
        return;
      }

      const ps = new window.kakao.maps.services.Places();
      const kwIn = stripPartyAndChatterForKeywordSearch(keyword) || keyword;
      
      // 1. 지역명 추출 (문정역·강남역 등 — \w+역은 한글 역명에서 실패함)
      let locationName = extractLocationAnchorFromQuery(kwIn);
      if (!locationName) {
        const areaHit = findAreaKeywordInQuery(kwIn);
        if (areaHit) locationName = areaHit;
      }
      
      // 2. 키워드 의도 추출 (음식 / 술집 — 기본값을 술집으로 두지 않음)
      const normalizedKeyword = kwIn.replace(/\s+/g, "");
      const isPojangmacha =
        normalizedKeyword.includes("포장마차") ||
        normalizedKeyword.includes("포차");
      const foodKeywords = [
        "해장국", "해장", "국밥", "순대국", "감자탕", "곰탕", "설렁탕", "칼국수", "라면", "냉면",
        "짜장면", "짬뽕", "우동", "쌀국수", "돈까스", "초밥",
        "해산물", "횟집", "해물", "생선회", "회집", "조개", "새우",
        "삼겹살", "갈비", "치킨",
        "족발", "보쌈", "한식", "중식", "일식", "양식", "분식", "식당", "맛집", "카페", "커피",
        "브런치", "빵", "케이크", "디저트", "피자", "파스타", "스테이크", "햄버거", "샐러드",
        "죽", "백반", "도시락", "김밥", "떡볶이", "순대", "만두", "전골", "찌개", "탕", "국수",
      ];
      const matchedFoodKeyword = foodKeywords.find((k) => kwIn.includes(k)) || null;
      const barKeywords = [
        "야장술집",
        "야장",
        "포장마차",
        "술집",
        "포차",
        "펍",
        "주점",
        "호프",
        "이자카야",
        "와인바",
        "칵테일바",
        "맥주",
        "소주",
        "하이볼",
        "위스키",
        "칵테일",
      ];
      const matchedBarKeyword = barKeywords.find((k) => kwIn.includes(k)) || null;
      const vagueNightOut =
        !matchedFoodKeyword &&
        !matchedBarKeyword &&
        /(?:술|맥주|소주|하이볼|2차|이차|뒷풀이|회식|회식\s*후|술집|포차)/.test(
          normalizedKeyword
        );
      const hoesikSearchKeyword = /회식|단체|워크샵|팀\s*저녁|부서/.test(
        normalizedKeyword
      );
      const barKeyword = isPojangmacha
        ? "포장마차"
        : matchedBarKeyword ||
          (vagueNightOut
            ? hoesikSearchKeyword
              ? "회식"
              : "술집"
            : null);

      let searchKeyword;
      let searchLocation;

      const tailAfterLocation = locationName
        ? kwIn
            .replace(new RegExp(locationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")
            .trim()
        : kwIn.trim();

      let intentPhrase = null;
      if (isPojangmacha && matchedFoodKeyword) {
        intentPhrase = `${matchedFoodKeyword} 포장마차`;
      } else if (isPojangmacha) {
        intentPhrase = "포장마차";
      } else {
        intentPhrase = matchedFoodKeyword || barKeyword || null;
      }

      if (locationName) {
        searchKeyword = intentPhrase
          ? `${locationName} ${intentPhrase}`
          : tailAfterLocation
            ? `${locationName} ${tailAfterLocation}`
            : locationName;
        searchLocation = null;
        console.log("🔍 지역명 기반 검색:", searchKeyword);
      } else {
        searchKeyword = intentPhrase || kwIn.trim();
        searchLocation = userLocation;
        console.log("🔍 현재 위치 기반 검색:", searchKeyword);
      }

      const kakaoSuffix = getKakaoKeywordSuffix(keyword);
      if (kakaoSuffix) searchKeyword = `${searchKeyword} ${kakaoSuffix}`.trim();

      const searchOptions = {
        category_group_code: 'FD6', // 음식점
        sort: window.kakao.maps.services.SortBy.DISTANCE
      };

      if (searchLocation) {
        // 현재 위치 기반 검색
        searchOptions.location = new window.kakao.maps.LatLng(searchLocation.lat, searchLocation.lng);
        const walkish =
          /걸어|도보|걸어서|걸어가|걸어갈|walking/i.test(kwIn) ||
          /걸어|도보|걸어서|걸어가|걸어갈|walking/i.test(String(keyword || ""));
        searchOptions.radius =
          matchedFoodKeyword === "해산물" || kwIn.includes("해산물")
            ? 2000
            : walkish
              ? 1200
              : 800;
      }

      ps.keywordSearch(
        searchKeyword,
        (data, status) => {
          if (status === window.kakao.maps.services.Status.OK) {
            let nearbyPlaces;
            
            if (locationName) {
              nearbyPlaces = data.map(place => ({
                ...place,
                distance: 0,
                walkingTime: 0,
              }));

              if (isPojangmacha) {
                const strictMatched = nearbyPlaces.filter((place) => {
                  const haystack = `${place.category_name || ""} ${place.place_name || ""}`;
                  return /포장마차|포차|실내포장마차|마차/i.test(haystack);
                });
                nearbyPlaces =
                  strictMatched.length > 0
                    ? strictMatched
                    : nearbyPlaces.filter((place) => {
                        const haystack = `${place.category_name || ""} ${place.place_name || ""}`;
                        return /주점|술집|이자카야|호프|bar|pub|요리주점/i.test(haystack);
                      });
              } else if (queryWantsYajangFocus(kwIn, parseSearchQuery(kwIn))) {
                const yStrict = nearbyPlaces.filter((place) => {
                  const haystack = `${place.category_name || ""} ${place.place_name || ""}`;
                  if (YAJANG_PLACE_HINT_RE.test(haystack)) return true;
                  if (
                    Array.isArray(curatorPlaceCatalogForMerge) &&
                    curatorPlaceCatalogForMerge.length
                  ) {
                    const m = findCuratorCatalogMatch(
                      place,
                      curatorPlaceCatalogForMerge
                    );
                    if (m && placeSignalsYajangCuratorMeta(m)) return true;
                  }
                  return false;
                });
                if (yStrict.length > 0) nearbyPlaces = yStrict;
              }

              console.log(`🍺 ${locationName} 지역명 검색 결과:`, nearbyPlaces.length);
            } else {
              // 현재 위치 기반 검색은 800m 이내 필터링
              const placesWithDistance = data
                .map((place) => {
                  const distance = Math.round(
                    calculateDistance(userLocation.lat, userLocation.lng, place.y, place.x)
                  );
                  return {
                    ...place,
                    distance,
                    walkingTime: Math.max(1, Math.round(distance / 67)), // 약 4km/h 기준
                  };
                })
                .filter((place) => {
                  const maxM =
                    matchedFoodKeyword === "해산물" || kwIn.includes("해산물")
                      ? 2000
                      : /걸어|도보|걸어서|걸어가|걸어갈|walking/i.test(kwIn) ||
                          /걸어|도보|걸어서|걸어가|걸어갈|walking/i.test(
                            String(keyword || "")
                          )
                        ? 1200
                        : 800;
                  return place.distance <= maxM;
                });

              if (isPojangmacha) {
                const strictMatched = placesWithDistance.filter((place) => {
                  const haystack = `${place.category_name || ""} ${place.place_name || ""}`;
                  return /포장마차|포차|실내포장마차|마차/.test(haystack);
                });

                // 엄격 필터 결과가 0건일 때만 완화 필터 fallback
                nearbyPlaces =
                  strictMatched.length > 0
                    ? strictMatched
                    : placesWithDistance.filter((place) => {
                        const haystack = `${place.category_name || ""} ${place.place_name || ""}`;
                        return /주점|술집|이자카야|호프|bar|pub/i.test(haystack);
                      });
              } else if (matchedFoodKeyword) {
                nearbyPlaces = placesWithDistance;
              } else {
                nearbyPlaces = placesWithDistance;
              }

              if (
                !isPojangmacha &&
                queryWantsYajangFocus(kwIn, parseSearchQuery(kwIn))
              ) {
                const yStrict = nearbyPlaces.filter((place) => {
                  const haystack = `${place.category_name || ""} ${place.place_name || ""}`;
                  if (YAJANG_PLACE_HINT_RE.test(haystack)) return true;
                  if (
                    Array.isArray(curatorPlaceCatalogForMerge) &&
                    curatorPlaceCatalogForMerge.length
                  ) {
                    const m = findCuratorCatalogMatch(
                      place,
                      curatorPlaceCatalogForMerge
                    );
                    if (m && placeSignalsYajangCuratorMeta(m)) return true;
                  }
                  return false;
                });
                if (yStrict.length > 0) nearbyPlaces = yStrict;
              }

              console.log(`🍺 ${searchKeyword} 근처 검색 결과:`, nearbyPlaces.length);
            }
            
            resolve(nearbyPlaces);
          } else {
            console.log(`🍺 ${searchKeyword} 검색 결과 없음:`, status);
            resolve([]);
          }
        },
        searchOptions
      );
    });
  };

  /**
   * "A or B", "또는", "|" 또는 한 문장에 2차·술집 + 와인바가 같이 있으면
   * 카카오 키워드 검색을 나눠 병합해 후보 풀을 넓힌다.
   */
  const mergeNearbyKakaoForOrQuery = async (keyword, userLocation) => {
    const strip =
      stripPartyAndChatterForKeywordSearch(keyword) ||
      String(keyword || "").trim();
    if (!strip) return [];

    const parts = strip
      .split(/\s+(?:or|또는)\s+|\s*\|\s*/i)
      .map((s) => s.trim())
      .filter(Boolean);

    const dedupeMerge = async (queries) => {
      const merged = [];
      const seen = new Set();
      for (const q of queries) {
        const chunk = await searchNearbyBars(q, userLocation);
        for (const pl of chunk) {
          const id = pl?.id != null ? String(pl.id) : null;
          if (id) {
            if (seen.has(id)) continue;
            seen.add(id);
          }
          merged.push(pl);
        }
      }
      return merged;
    };

    if (parts.length >= 2) {
      const m = await dedupeMerge(parts);
      if (m.length) return m;
    }

    if (
      /와인바|와인\s*바/i.test(strip) &&
      /(?:2차|이차|술집|뒷풀이)/i.test(strip)
    ) {
      const m = await dedupeMerge(["술집", "와인바"]);
      if (m.length) return m;
    }

    return searchNearbyBars(keyword, userLocation);
  };

  // 네이버 블로그 검색 함수
  // 카카오 API로 장소 추가 정보 가져오기
  const enrichPlaceWithKakaoInfo = async (place) => {
    const hasUsefulCategory = Boolean(
      (place.category_name && String(place.category_name).trim()) ||
        (place.category &&
          String(place.category).trim() &&
          place.category !== "미분류")
    );
    const wgs0 = resolvePlaceWgs84(place);
    const coordsOk =
      wgs0 && isLikelyKoreaWgs84(wgs0.lat, wgs0.lng);
    if (place.isKakaoEnriched && hasUsefulCategory && coordsOk) {
      return place;
    }

    const labelForSearch =
      (place?.name && String(place.name).trim()) ||
      (place?.place_name && String(place.place_name).trim()) ||
      "";
    const firstAddr = [
      place?.address,
      place?.road_address_name,
      place?.address_name,
    ]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .find((s) => s.length > 0);

    if (!labelForSearch && !firstAddr) {
      return place;
    }
    const keywordQuery = labelForSearch || firstAddr.slice(0, 80);

    try {
      if (import.meta.env.DEV) {
        console.log("🔍 카카오 장소 정보 조회 (서버 프록시):", keywordQuery);
      }

      const py = parseFloat(place.lat ?? place.y);
      const px = parseFloat(place.lng ?? place.x);

      const idCandidates = [
        place.kakao_place_id,
        place.place_id,
        place.kakaoId,
      ]
        .map((x) => (x != null ? String(x).trim() : ""))
        .filter((s) => /^\d+$/.test(s));

      /** 브라우저에서 dapi.kakao.com 직접 호출은 CORS로 막히므로 백엔드 프록시 사용 */
      let kakaoPlace = null;
      for (const kid of idCandidates) {
        kakaoPlace = await getKakaoPlaceDetailsViaProxy(kid, {
          query: keywordQuery,
          x: Number.isFinite(px) ? px : undefined,
          y: Number.isFinite(py) ? py : undefined,
        });
        if (kakaoPlace && (kakaoPlace.category_name || kakaoPlace.place_name)) {
          break;
        }
      }

      if (!kakaoPlace) {
        const { documents: docs } = await searchKakaoKeywordViaProxy({
          query: keywordQuery,
          x: Number.isFinite(px) ? px : undefined,
          y: Number.isFinite(py) ? py : undefined,
          radius: 500,
          size: 15,
        });

        for (const kid of idCandidates) {
          kakaoPlace = docs.find((d) => String(d.id) === kid);
          if (kakaoPlace) break;
        }
        if (!kakaoPlace && docs.length) {
          kakaoPlace = docs[0];
        }
      }

      if (!kakaoPlace) {
        const addrQ = [
          place.address,
          place.road_address_name,
          place.address_name,
        ]
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .find((s) => s.length >= 4);
        if (addrQ) {
          const { documents: adocs } = await searchKakaoAddressViaProxy({
            query: addrQ,
            size: 5,
          });
          const d0 = Array.isArray(adocs) ? adocs[0] : null;
          if (d0) {
            const ky = parseFloat(d0.y);
            const kx = parseFloat(d0.x);
            if (Number.isFinite(ky) && Number.isFinite(kx)) {
              kakaoPlace = {
                ...d0,
                place_name: d0.place_name || place.name,
                category_name:
                  d0.category_name ||
                  place.category_name ||
                  place.category ||
                  "",
                id: d0.id,
              };
            }
          }
        }
      }

      if (kakaoPlace) {
        if (import.meta.env.DEV) {
          console.log("✅ 카카오 장소 정보 찾음:", kakaoPlace.place_name);
        }

        const ky = parseFloat(kakaoPlace.y);
        const kx = parseFloat(kakaoPlace.x);
        const catFromKakao =
          kakaoPlace.category_name ||
          place.category_name ||
          place.category ||
          "";

        const resolvedName =
          (kakaoPlace.place_name && String(kakaoPlace.place_name).trim()) ||
          (place.name && String(place.name).trim()) ||
          (place.place_name && String(place.place_name).trim()) ||
          keywordQuery;

        const enrichedPlace = {
          ...place,
          name: resolvedName,
          category: catFromKakao || place.category,
          category_name: catFromKakao || place.category_name,
          phone: kakaoPlace.phone || place.phone,
          road_address_name: kakaoPlace.road_address_name || place.address,
          address_name: kakaoPlace.address_name || place.address,
          place_url: kakaoPlace.place_url,
          x: kakaoPlace.x,
          y: kakaoPlace.y,
          ...(Number.isFinite(ky) && Number.isFinite(kx)
            ? { lat: ky, lng: kx }
            : {}),
          isKakaoEnriched: true,
          kakaoId: kakaoPlace.id,
        };

        // Supabase places 스키마(앱 전반): name, address, lat, lng, category, kakao_place_id, phone 등만 존재.
        // category_name / x / y / kakaoId / isKakaoEnriched 는 DB 컬럼이 아니면 400.
        try {
          const kid =
            kakaoPlace.id != null ? String(kakaoPlace.id).trim() : "";
          const nextAddr =
            (kakaoPlace.road_address_name &&
              String(kakaoPlace.road_address_name).trim()) ||
            (kakaoPlace.address_name &&
              String(kakaoPlace.address_name).trim()) ||
            null;
          const nextCat =
            (kakaoPlace.category_name &&
              String(kakaoPlace.category_name).trim()) ||
            (place.category && String(place.category).trim()) ||
            null;
          const patch = {};
          if (resolvedName) patch.name = resolvedName;
          if (nextCat) patch.category = nextCat;
          if (nextAddr) patch.address = nextAddr;
          if (kakaoPlace.phone != null && String(kakaoPlace.phone).trim() !== "") {
            patch.phone = String(kakaoPlace.phone).trim();
          }
          if (Number.isFinite(ky) && Number.isFinite(kx)) {
            patch.lat = ky;
            patch.lng = kx;
          }
          if (/^\d+$/.test(kid)) {
            patch.kakao_place_id = kid;
          }

          if (Object.keys(patch).length === 0) {
            if (import.meta.env.DEV) {
              console.log("⏭️ Supabase places PATCH 생략: 갱신할 필드 없음");
            }
          } else {
            const { error: updErr } = await supabase
              .from("places")
              .update(patch)
              .eq("id", place.id);
            if (updErr) {
              if (import.meta.env.DEV) {
                console.warn("⚠️ Supabase places PATCH 실패:", updErr.message);
              }
            } else if (import.meta.env.DEV) {
              console.log("🔄 Supabase 장소 정보 PATCH 완료");
            }
          }
        } catch (updateError) {
          if (import.meta.env.DEV) {
            console.log("⚠️ Supabase 업데이트 예외:", updateError.message);
          }
        }

        return enrichedPlace;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.log("⚠️ 카카오 장소 정보 조회 오류:", error.message);
      }
    }

    return place;
  };

  const searchBlogReviews = async (keyword) => {
    const q = typeof keyword === "string" ? keyword.trim() : "";
    if (!q) return [];

    const BLOG_FETCH_MS = 28000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BLOG_FETCH_MS);

    try {
      console.log("📝 서버 블로그 크롤 요청:", q);
      const url = AI_API_BASE
        ? `${AI_API_BASE}/api/blog-reviews`
        : "/api/blog-reviews";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn("📝 blog-reviews HTTP", res.status);
        return [];
      }
      const data = await res.json();
      const list = Array.isArray(data.blogReviews) ? data.blogReviews : [];
      console.log("📝 블로그 리뷰 수:", list.length);
      return list;
    } catch (error) {
      if (error?.name === "AbortError") {
        console.warn("📝 블로그 요청 시간 초과 — 지도 결과는 그대로 사용");
      } else {
        console.warn("📝 네이버 블로그 요청 실패 (서버 미기동 또는 크롤러 오류):", error);
      }
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const searchMapBars = async (keyword) => {
    if (!window.kakao?.maps?.services || !mapRef.current) {
      console.error("❌ searchMapBars: 카카오 API 또는 맵 레퍼런스 없음");
      return [];
    }

    const kwMap = stripPartyAndChatterForKeywordSearch(keyword) || keyword;
    const mapBounds = mapRef.current.getBounds();
    if (!mapBounds) {
      console.error("❌ searchMapBars: 지도 영역 없음");
      return [];
    }

    const geoAnchored = kakaoQueryHasGeographicAnchor(kwMap);
    const useApiBounds = !geoAnchored;
    const queries = expandFoodKakaoQueries(kwMap);

    console.log("🗺️ searchMapBars:", { kwMap, geoAnchored, useApiBounds, queries });

    const runOne = (q) =>
      new Promise((resolve) => {
        const ps = new window.kakao.maps.services.Places();
        const opts = {
          category_group_code: "FD6",
          sort: window.kakao.maps.services.SortBy.ACCURACY,
        };
        if (useApiBounds) opts.bounds = mapBounds;

        ps.keywordSearch(
          q,
          (data, status) => {
            if (status !== window.kakao.maps.services.Status.OK) {
              resolve([]);
              return;
            }
            let list = (data || []).map((place) => ({ ...place, distance: 0 }));
            if (!geoAnchored) {
              list = list.filter((place) => {
                const placeLatLng = new window.kakao.maps.LatLng(place.y, place.x);
                return mapBounds.contain(placeLatLng);
              });
            }
            resolve(list);
          },
          opts
        );
      });

    const batches = await Promise.all(queries.map((q) => runOne(q)));
    const seen = new Set();
    const merged = [];
    for (const list of batches) {
      for (const p of list) {
        const id = String(p.id ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(p);
      }
    }
    console.log("🗺️ searchMapBars 병합 건수:", merged.length, "쿼리 수:", queries.length);
    return merged;
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // 미터로 변환
  };

  /** 카카오 후보 위 룰 기반 점수·한 줄 이유. 정렬: 의미 점수와 거리를 함께 반영(가까운 잡식당만 남는 현상 완화). */
  const calculateLocalAIScores = (
    places,
    keyword,
    userLocation = null,
    sortOrigin = null
  ) => {
    const LOCAL_AI_TOP_N = 18;
    const KW_OVERLAP_STOP = new Set([
      "근처",
      "주변",
      "가까운",
      "에서",
      "으로",
      "까지",
      "먹고",
      "하고",
      "갈까",
      "추천",
      "검색",
      "이야",
      "명이야",
      "명",
      "때",
      "좀",
      "한",
      "잘",
      "같이",
      "해요",
      "or",
      "있는",
    ]);

    const party = parsePartySize(keyword);
    const kwSc = stripPartyAndChatterForKeywordSearch(keyword) || keyword;
    const wantWalkable =
      /걸어|도보|근처|가까운|걸어서|걸어가|걸어갈|walking/i.test(kwSc);
    const wantQuiet = /조용|차분|한적|quiet/i.test(kwSc);
    const parsedFacets = parseSearchQuery(keyword);
    const wantsSeafood = queryWantsSeafoodFocus(keyword, parsedFacets);
    const wantsYajang = queryWantsYajangFocus(keyword, parsedFacets);
    const originForDistance = userLocation || sortOrigin || null;

    const metersForSort = (place) => {
      const d = place.distance;
      if (typeof d === "number" && Number.isFinite(d) && d > 0) return d;
      if (!originForDistance) return Number.POSITIVE_INFINITY;
      const lat = parseFloat(place.y ?? place.lat);
      const lng = parseFloat(place.x ?? place.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return Number.POSITIVE_INFINITY;
      }
      return calculateDistance(
        originForDistance.lat,
        originForDistance.lng,
        lat,
        lng
      );
    };

    const barTokens = [
      "술집", "포차", "호프", "이자카야", "주점", "펍", "와인바", "칵테일바", "맥주", "소주",
      "하이볼", "위스키", "2차", "이차", "와인",
    ];
    const barHit = barTokens.some((t) => kwSc.includes(t));

    const queryKeywordOverlapBoost = (textLower) => {
      const parts = kwSc
        .toLowerCase()
        .split(/[\s,./·|]+/u)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && !KW_OVERLAP_STOP.has(s));
      let add = 0;
      for (const p of parts) {
        if (p && textLower.includes(p)) add += 8;
      }
      return Math.min(add, 44);
    };

    const distanceRankPenalty = (distM) => {
      if (
        !Number.isFinite(distM) ||
        distM <= 0 ||
        distM >= 1e8
      ) {
        return 24;
      }
      return Math.min(distM / 16, 90);
    };

    const blogInsightBoost = (place) => {
      const bi = place.blogInsight;
      if (!bi || typeof bi !== "object") return 0;
      const k = kwSc.toLowerCase();
      let add = 0;
      const hitArr = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const x of arr) {
          if (typeof x === "string" && x && k.includes(x.toLowerCase())) {
            add += 5;
          }
        }
      };
      hitArr(bi.atmosphere);
      hitArr(bi.menu);
      hitArr(bi.purpose);
      hitArr(bi.drink);
      return Math.min(add, 15);
    };

    return places.map(place => {
      const facetResult = scorePlace(place, parsedFacets);
      let score = facetResult.score;
      const cat = `${place.category_name || ""} ${place.place_name || ""}`;
      const catLower = cat.toLowerCase();
      score += queryKeywordOverlapBoost(catLower);

      if (wantsSeafood && isObviousNonSeafoodKakaoPlace(place)) {
        score -= 120;
      }

      if (wantsYajang) {
        const textHit = YAJANG_PLACE_HINT_RE.test(cat);
        let curatorHit = placeSignalsYajangCuratorMeta(place);
        if (
          !curatorHit &&
          Array.isArray(curatorPlaceCatalogForMerge) &&
          curatorPlaceCatalogForMerge.length
        ) {
          const canon = findCuratorCatalogMatch(place, curatorPlaceCatalogForMerge);
          curatorHit = canon ? placeSignalsYajangCuratorMeta(canon) : false;
        }
        if (textHit) score += 34;
        if (curatorHit) score += 30;
        if (!textHit && !curatorHit) score -= 26;
      }

      // 거리·도보는 파싱 축과 별도(위치기반 검색)
      if (userLocation && place.distance > 0) {
        score += Math.max(0, 50 - place.distance / 16);
      }
      if (userLocation && place.distance > 0 && place.distance <= 500) {
        score += 15;
      }
      if (wantWalkable && userLocation && place.distance > 0 && place.distance <= 400) {
        score += 10;
      }

      if (wantQuiet) {
        if (
          /와인|wine|와인바|펍|라운지|lounge|바(?![a-z])|wine\s*bar/i.test(
            catLower
          )
        ) {
          score += 12;
        }
        if (/조용|차분|한적|룸|프라이빗|private|와인/i.test(catLower)) {
          score += 10;
        }
        if (/클럽|노래방|코인노래|룸싸롱|단란주점|댄스/i.test(catLower)) {
          score -= 38;
        }
      }

      // 인원(근사): 좌석 수 없음 — 단체·포차류만 보조 가점
      // 해산물 검색에서 «회식»만 맞는 치킨·회식집이 과대 가점 받는 것 방지
      if (party != null && party >= 3) {
        if (/포장마차|포차|실내포장마차|단체|대형|홀/i.test(cat)) score += 12;
        else if (/회식/i.test(cat) && !wantsSeafood) score += 12;
        if (party >= 5) score += 5;
      }
      if (party === 2 && (kwSc.includes("데이트") || barHit)) {
        if (/바|와인|라운지|펍/i.test(cat)) score += 8;
      }

      score += blogInsightBoost(place);

      const atmosphere = getAtmosphereFromCategory(place.category_name);
      const sourceKakaoId = place.id;

      const distM = metersForSort(place);
      const whyRecommended = buildRecommendationWhyLine(place, parsedFacets);

      return {
        ...place,
        distance:
          typeof place.distance === "number" &&
          Number.isFinite(place.distance) &&
          place.distance > 0
            ? place.distance
            : distM < Number.POSITIVE_INFINITY
              ? Math.round(distM)
              : place.distance,
        aiScore: Math.round(score),
        whyRecommended,
        recommendation: getLocalRecommendationReason(score, keyword, place, userLocation, {
          party,
          kwSc,
          wantWalkable,
          facetReasons: facetResult.reasons,
          omitFacetReasons: Boolean(whyRecommended),
        }),
        matchedFacetLabels: matchedQueryFacetLabels(place, parsedFacets),
        searchRepresentativeTag: representativePlaceTag({
          ...place,
          atmosphere,
        }),
        estimatedCapacity: 20,
        atmosphere,
        kakao_place_id: place.kakao_place_id ?? sourceKakaoId,
        id: `local_${sourceKakaoId}`,
        isExternal: true
      };
    })
      .sort((a, b) => {
        const da = metersForSort(a);
        const db = metersForSort(b);
        const sa = a.aiScore ?? 0;
        const sb = b.aiScore ?? 0;
        const ra = sa - distanceRankPenalty(da);
        const rb = sb - distanceRankPenalty(db);
        if (rb !== ra) return rb - ra;
        if (da !== db) return da - db;
        return sb - sa;
      })
      .slice(0, LOCAL_AI_TOP_N);
  };

  const getAtmosphereFromCategory = (category) => {
    const c = category || "";
    if (c.includes('바') || c.includes('펍')) return '조용한';
    if (c.includes('호프') || c.includes('주점')) return '활기찬';
    if (c.includes('포차') || c.includes('선술집')) return '전통적인';
    return '일반적인';
  };

  const getLocalRecommendationReason = (score, keyword, place, userLocation = null, hints = {}) => {
    const reasons = [];
    const party = hints.party ?? parsePartySize(keyword);
      const kwSc = hints.kwSc ?? (stripPartyAndChatterForKeywordSearch(keyword) || keyword);
    const wantWalkable = hints.wantWalkable ?? /걸어|도보|근처|가까운/.test(kwSc);
    const facetReasons = hints.facetReasons;
    if (
      !hints.omitFacetReasons &&
      Array.isArray(facetReasons) &&
      facetReasons.length > 0
    ) {
      reasons.push(facetReasons.slice(0, 4).join(", "));
    }

    // 거리 기반 추천 (위치기반 검색만 적용)
    if (userLocation && place.distance > 0) {
      if (place.distance <= 300) reasons.push('도보 5분 거리');
      if (place.distance <= 500) reasons.push('도보 10분 거리');
      if (wantWalkable && place.distance <= 400) reasons.push('걸어가기 부담 없는 거리');
    }
    
    const cn = place.category_name || "";
    // 카테고리 기반 추천
    if (cn.includes('포차')) reasons.push('전통적인 분위기');
    if (cn.includes('바')) reasons.push('조용한 분위기');
    if (cn.includes('호프')) reasons.push('활기찬 분위기');

    // 키워드 기반(파싱 매칭 이유가 없을 때만 보조)
    if (!facetReasons?.length) {
      if (kwSc.includes('2차') || kwSc.includes('이차')) reasons.push('2차 술집 추천');
      if (kwSc.includes('해장') || kwSc.includes('국밥')) reasons.push('해장·국밥류 후보');
      if (kwSc.includes('카페') || kwSc.includes('커피')) reasons.push('카페·음료 후보');
    }
    if (party != null && party >= 3) {
      reasons.push(`인원 ${party}명 기준 단체·포차 후보(좌석은 현장 확인)`);
    }
    
    // 전체 지도 검색의 경우
    if (!userLocation || place.distance === 0) {
      reasons.push('지도 전체 검색');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : '검색·거리 기준 후보';
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [isCurator, setIsCurator] = useState(false);
  const curatorWelcomeRef = useRef(false); // 큐레이터 상태 변화 감지용 ref
  const [curatorProfile, setCuratorProfile] = useState(null); // 큐레이터 프로필 정보
  const [dbCurators, setDbCurators] = useState([]); // DB에서 가져온 큐레이터 목록
  const [dbPlaces, setDbPlaces] = useState([]); // DB에서 가져온 장소 목록 (현재 지도 뷰포트 기준)

  /** attachCuratorsToCuratorPlaceRows 용 Supabase 원본 행 */
  const curatorAttachRowsRef = useRef([]);
  const mapViewportLoadSeqRef = useRef(0);
  const lastMapBoundsRef = useRef(null);
  const lastMapLevelRef = useRef(null);
  const placeDetailRequestSeqRef = useRef(0);

  const [query, setQuery] = useState("");
  const [mapViewportDbLoading, setMapViewportDbLoading] = useState(false);

  /** 검색어가 있을 땐 뷰포트마다 DB 전량 갱신하지 않음(검색·카카오 쪽 우선). */
  const loadDbPlacesForViewport = useCallback(
    async ({ boundsRaw }) => {
      if (authLoading) return;
      if (String(query || "").trim()) return;

      const seq = ++mapViewportLoadSeqRef.current;
      const snap = curatorAttachRowsRef.current;
      if (!Array.isArray(snap) || snap.length === 0) {
        setMapViewportDbLoading(false);
        return;
      }

      const padded = padLatLngBounds(boundsRaw.sw, boundsRaw.ne, 0.12);
      if (!padded) {
        setMapViewportDbLoading(false);
        return;
      }

      setMapViewportDbLoading(true);
      try {
        const { rows, error } = await fetchCuratorPlaceRowsInBounds(
          supabase,
          padded
        );
        if (seq !== mapViewportLoadSeqRef.current) return;
        if (error) {
          console.error("❌ 뷰포트 추천 로드 오류:", error);
          return;
        }
        const filtered = filterJoinRowsToBounds(rows, padded);
        const attached = attachCuratorsToCuratorPlaceRows(filtered, snap);
        setDbPlaces(buildFormattedPlacesFromJoin(attached));
      } catch (e) {
        console.error("❌ 뷰포트 추천 로드 실패:", e);
      } finally {
        if (seq === mapViewportLoadSeqRef.current) {
          setMapViewportDbLoading(false);
        }
      }
    },
    [authLoading, query]
  );

  const debouncedScheduleDbPlaces = useMemo(
    () =>
      debounce((payload) => {
        void loadDbPlacesForViewport(payload);
      }, 400),
    [loadDbPlacesForViewport]
  );

  const scheduleDbPlacesForBounds = useCallback(
    (boundsRaw, mapLevel) => {
      debouncedScheduleDbPlaces({ boundsRaw, mapLevel });
    },
    [debouncedScheduleDbPlaces]
  );

  /** 하단 검색바: `basic` 카카오·경량 / `ai` 기존 주도·의도·통합 검색 */
  const [homeSearchChannel, setHomeSearchChannel] = useState("basic");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const searchSessionIdRef = useRef(null);
  const [showFollowModal, setShowFollowModal] = useState(false); // 팔로우 모달 상태
  const [selectedCurator, setSelectedCurator] = useState(null); // 선택된 큐레이터 정보
  const [saveTargetPlace, setSaveTargetPlace] = useState(null);
  const [folders, setFolders] = useState([]);
  const [savedMap, setSavedMap] = useState({});
  const [kakaoPlaces, setKakaoPlaces] = useState([]); // 카카오 장소들을 위한 state
  /** 카카오 키워드 자동완성 후보 — 리스트와 동일하게 지도에 전부 표시 */
  const [kakaoTypingPreviewPlaces, setKakaoTypingPreviewPlaces] = useState([]);
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [blogReviews, setBlogReviews] = useState([]); // 네이버 블로그 리뷰 상태
  const [customPlaces, setCustomPlaces] = useState([]); // 더미 데이터 제거
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [selectedCurators, setSelectedCurators] = useState([]);
  const selectedCuratorsRef = useRef([]);
  selectedCuratorsRef.current = selectedCurators;
  const [showAll, setShowAll] = useState(true); // 기본값을 true로 변경
  const [userSavedPlaces, setUserSavedPlaces] = useState({}); // 사용자 저장 장소 폴더 정보

  const [aiSummary, setAiSummary] = useState("");
  const [aiReasons, setAiReasons] = useState([]);
  const [aiRecommendedIds, setAiRecommendedIds] = useState([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  /** 단순 위치+메뉴 검색: 맞춤 피크바·자동 시트 없이 지도 마커만 */
  const [simpleMapSearchMarkersOnly, setSimpleMapSearchMarkersOnly] =
    useState(false);
  const [loadingDots, setLoadingDots] = useState(".");
  const [searchLoadingLabel, setSearchLoadingLabel] = useState("");
  const [searchExpandUX, setSearchExpandUX] = useState(null);
  /** 야장 검색 무결과 → 5km 큐레이터 폴백 안내 */
  const [yajangFallbackBanner, setYajangFallbackBanner] = useState(null);
  const [searchDistanceOrigin, setSearchDistanceOrigin] = useState(null); // 추천 리스트 거리·도보 표시용 기준 좌표
  const [isLocationBasedSearch, setIsLocationBasedSearch] = useState(false); // 위치기반 검색 여부
  /** 지역명만 검색해 줌인한 뒤 — 「여기서 검색」 */
  const [showMapSearchHereButton, setShowMapSearchHereButton] = useState(false);
  const searchHereArmedRef = useRef(false);
  /** 「여기서 검색」확정 후 다음 검색까지 뷰포트 유지·화면 안 검색 */
  const [mapViewportSearchLock, setMapViewportSearchLock] = useState(false);

  const [legendCategory, setLegendCategory] = useState(null);
  /** 지도 빈 곳 클릭 시 증가 → MarkerLegend 패널 닫기 */
  const [markerGuideMapCloseTick, setMarkerGuideMapCloseTick] = useState(0);

  const [livePlaceIds, setLivePlaceIds] = useState(() => new Set());
  const [showUserCard, setShowUserCard] = useState(false); // UserCard 표시 상태
  /** 일반 유저 공개 프로필(profiles) — 닉네임·핸들. 로그인 계정(이메일)과 UI 분리 */
  const [mapUserProfile, setMapUserProfile] = useState(null);
  const [searchBarProfileImgFailed, setSearchBarProfileImgFailed] =
    useState(false);

  /** 검색바 우측 @ / 로그아웃 등이 모바일에서 입력칸을 잡아먹지 않게 */
  const [compactSearchBarAuth, setCompactSearchBarAuth] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 520px)").matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 520px)");
    const onChange = () => setCompactSearchBarAuth(mq.matches);
    onChange();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  // 로그인 유도 모달 훅
  const { showLoginPrompt, requiredFeature, requireLogin, closeLoginPrompt } = useLoginRequired();

  const {
    courseOptions,
    selectedCourse,
    altSecondCourses,
    altFirstCourses,
    courseError,
    isCourseMode,
    isRegeneratingSecond,
    isRegeneratingFirst,
    isRefreshingCourses,
    runCourseSearch,
    resetCourseSearch,
    chooseCourse,
    regenerateSelectedCourseSecond,
    regenerateSelectedCourseFirst,
    rerunDifferentCourses,
    applyAlternativeSecond,
    applyAlternativeFirst,
    applyComposedCourseFromPicks,
    applyMapPickAsFirstStepAsync,
    computeSecondStepCandidatesOnly,
    applySecondStepPick,
    courseQueryParsed,
  } = useCourseSearch();

  const courseStepPatternHint = useMemo(() => {
    if (!isCourseMode || !courseQueryParsed) return "";
    const mode =
      courseQueryParsed.mode ?? courseQueryParsed.dateMode ?? "casual";
    const walk = courseQueryParsed.walkable ? " 도보·근거리 반영." : "";
    if (mode === "date") {
      return `1차·2차 구분: 데이트 패턴(1차 식사·분위기 → 2차 가볍게).${walk}`;
    }
    return `1차·2차 구분: 일반 야장 패턴(1차 식사·안주 → 2차 술집·바).${walk}`;
  }, [isCourseMode, courseQueryParsed]);

  const [courseMapOverlay, setCourseMapOverlay] = useState(null);
  /** 미리보기 「도착 길찾기」: 내 위치 → 선택 장소 (지도 주황 폴리라인) */
  const [arrivalWalkingOverlay, setArrivalWalkingOverlay] = useState(null);
  const arrivalWalkReqIdRef = useRef(0);
  /** 미리보기 닫혀도 유지 — 다른 장소 미리보기로 바뀔 때만 도착 경로 초기화용 */
  const lastPreviewPlaceRouteKeyRef = useRef("");
  /** 지역명만 검색 시 OSM 기반 행정구역 경계(맵 Polygon) */
  const [regionBoundaryOverlay, setRegionBoundaryOverlay] = useState(null);
  /** 경로 × 후 같은 코스 키면 폴리라인·1·2차 핀(kakaoPlaces)이 다시 안 잡히게 */
  const coursePathDismissedForCourseKeyRef = useRef(null);
  const [mapCourseFirstBusy, setMapCourseFirstBusy] = useState(false);
  /** 2차 후보 펄스 중: 펄스 마커 탭 시 미리보기에 「2차는 여기로」 */
  const [courseSecondPickMode, setCourseSecondPickMode] = useState(false);
  const lastSecondCandidatesRef = useRef([]);
  /** 2차 추천 직후: 후보 가게 마커 깜빡임(MapView courseMarkerPulse) */
  const [courseSecondPulseMapPlaces, setCourseSecondPulseMapPlaces] = useState(
    []
  );
  /** 지도 미리보기 「2차 찾기」— 분위기·주종 등 선택 후 후보 계산 */
  const [courseSecondFindModalOpen, setCourseSecondFindModalOpen] =
    useState(false);
  const [courseSecondFindVibes, setCourseSecondFindVibes] = useState([]);
  const [courseSecondFindLiquors, setCourseSecondFindLiquors] = useState([]);
  const [courseSecondFindAnju, setCourseSecondFindAnju] = useState([]);
  const [courseSecondFindPreferCloser, setCourseSecondFindPreferCloser] =
    useState(false);
  const [courseSecondFindPrioritizeCurators, setCourseSecondFindPrioritizeCurators] =
    useState(false);
  /** 2차 찾기: 1차 좌표 기준 최대 거리(m) — 후보 스코어·카카오 주변 검색 반경 */
  const [courseSecondFindMaxDistanceM, setCourseSecondFindMaxDistanceM] =
    useState(3000);
  /** 코스 카드에서 각각 담은 코스 조합 (미리보기 후 적용) */
  const [courseComposePick1, setCourseComposePick1] = useState(null);
  const [courseComposePick2, setCourseComposePick2] = useState(null);

  const clearCourseSecondPickPulse = useCallback(() => {
    setCourseSecondPickMode(false);
    lastSecondCandidatesRef.current = [];
    setCourseSecondPulseMapPlaces([]);
  }, []);

  useEffect(() => {
    if (!isCourseMode) {
      setCourseComposePick1(null);
      setCourseComposePick2(null);
      clearCourseSecondPickPulse();
      setCourseSecondFindModalOpen(false);
    }
  }, [isCourseMode, clearCourseSecondPickPulse]);

  /** 조합 미리보기: 1차/2차 담기만 해도 지도 마커·경로에 반영 */
  const composePreviewCourse = useMemo(() => {
    if (!courseComposePick1 && !courseComposePick2) return null;
    if (courseComposePick1 && courseComposePick2) {
      const st0 = courseComposePick1.steps?.[0];
      const st1 = courseComposePick2.steps?.[1];
      if (!st0?.place || !st1?.place) return null;
      const w0 = resolvePlaceWgs84(st0.place);
      const w1 = resolvePlaceWgs84(st1.place);
      const d =
        w0 && w1
          ? haversineMeters(w0.lat, w0.lng, w1.lat, w1.lng)
          : NaN;
      return {
        key: "__compose_preview__",
        steps: [
          { ...st0, step: 1, label: st0.label ?? "1차", place: st0.place },
          {
            ...st1,
            step: 2,
            label: st1.label ?? "2차",
            place: st1.place,
            walkDistanceMeters: Number.isFinite(d) ? Math.round(d) : st1.walkDistanceMeters,
          },
        ],
      };
    }
    if (courseComposePick1?.steps?.[0]?.place) {
      const st0 = courseComposePick1.steps[0];
      return {
        key: "__compose_preview__",
        steps: [{ ...st0, step: 1, label: st0.label ?? "1차" }],
      };
    }
    if (courseComposePick2?.steps?.[1]?.place) {
      const st1 = courseComposePick2.steps[1];
      return {
        key: "__compose_preview__",
        steps: [{ ...st1, step: 2, label: st1.label ?? "2차" }],
      };
    }
    return null;
  }, [courseComposePick1, courseComposePick2]);

  const courseDrivingMap = composePreviewCourse ?? selectedCourse;

  const [savedMyCoursesTick, setSavedMyCoursesTick] = useState(0);
  const [savedMyCoursePairKeys, setSavedMyCoursePairKeys] = useState(
    () => new Set()
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isCourseMode || !user?.id) {
        setSavedMyCoursePairKeys(new Set());
        return;
      }
      const keys = await fetchMySavedCoursePairKeys(supabase, user.id);
      if (!cancelled) setSavedMyCoursePairKeys(keys);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCourseMode, user?.id, savedMyCoursesTick]);

  /** 코스 UI 하단 높이만큼 setBounds 패딩 — 경로·마커가 바텀시트에 덜 가리게 */
  const courseMapFitBottomPaddingPx = useMemo(() => {
    if (!isCourseMode || !String(query || "").trim() || isAiSearching) return 0;
    if (typeof window === "undefined") return 360;
    const h = window.innerHeight;
    if (aiSheetOpen) {
      return Math.min(Math.round(h * 0.58) + 52, 560);
    }
    return Math.min(Math.round(h * 0.17) + 56, 180);
  }, [isCourseMode, query, isAiSearching, aiSheetOpen]);

  /** 코스 카드 가로 스와이프 — 스크롤이 멈춘 뒤에만 선택·지도 반영 (스크롤 중 휙휙 변경 방지) */
  const courseSwipeRowRef = useRef(null);
  const courseSwipeSettleTimerRef = useRef(null);
  const courseMergedHeaderRef = useRef(null);
  const coursePullStripRef = useRef(null);

  const settleCourseFromSwipe = useCallback(() => {
    const el = courseSwipeRowRef.current;
    if (!el || !courseOptions?.length) return;
    const idx = getCourseSwipeIndexFromScroll(el);
    const course = courseOptions[idx];
    if (course?.key && course.key !== selectedCourse?.key) {
      chooseCourse(course);
    }
  }, [courseOptions, selectedCourse?.key, chooseCourse]);

  const onCourseSwipeRowScroll = useCallback(() => {
    const prev = courseSwipeSettleTimerRef.current;
    if (prev != null) window.clearTimeout(prev);
    courseSwipeSettleTimerRef.current = window.setTimeout(() => {
      courseSwipeSettleTimerRef.current = null;
      settleCourseFromSwipe();
    }, 220);
  }, [settleCourseFromSwipe]);

  const handleSaveMyOwnCourse = useCallback(
    async (course, e) => {
      e?.stopPropagation?.();
      if (!user?.id) {
        showToast("코스 저장은 로그인 후 이용할 수 있어요.", "error", 2800);
        return;
      }
      const snap = snapshotFromMyOwnCourse(course);
      if (!snap.pairKey) {
        showToast("저장할 장소 정보가 부족해요.", "error", 2500);
        return;
      }
      const r = await insertSavedMyCourse(supabase, user.id, snap);
      if (r.ok) {
        showToast("코스를 저장했어요.", "success", 2600);
        setSavedMyCoursesTick((x) => x + 1);
      } else if (r.reason === "exists") {
        showToast("이미 저장된 조합이에요.", "info", 2400);
      } else if (r.reason === "auth") {
        showToast("로그인이 필요해요.", "error", 2500);
      } else {
        showToast(
          r.message ? `저장 실패: ${r.message}` : "저장하지 못했어요.",
          "error",
          3200
        );
      }
    },
    [user?.id, showToast]
  );

  /** 1차·2차 장소가 모두 잡힌 선택 코스 */
  const courseHasFinalTwoSteps = useMemo(() => {
    const steps = selectedCourse?.steps;
    if (!Array.isArray(steps) || steps.length < 2) return false;
    return Boolean(steps[0]?.place && steps[1]?.place);
  }, [selectedCourse]);

  /**
   * 검색 문장은 두고 코스만 비움. 먼저 초기화 확인 후, 저장 여부를 묻고(로그인 시 저장 시도) 리셋.
   */
  const dismissCourseMapPath = useCallback(() => {
    const k = String(courseDrivingMap?.key ?? "");
    if (k) coursePathDismissedForCourseKeyRef.current = k;
    setCourseMapOverlay(null);
    /** 경로 × — 2차 후보 펄스·후보 마커도 같이 종료 */
    clearCourseSecondPickPulse();
  }, [courseDrivingMap?.key, clearCourseSecondPickPulse]);

  const handleResetCoursePickWithSavePrompt = useCallback(async () => {
    const course = selectedCourse;
    if (!course?.steps?.[0]?.place || !course?.steps?.[1]?.place) return;

    const okClear = window.confirm(
      "선택한 코스(1차·2차)를 지울까요?\n검색 문장은 그대로 두고 코스만 비워요."
    );
    if (!okClear) return;

    const wantSave = window.confirm(
      "이 코스 조합을 내 코스에 저장할까요?\n\n「확인」저장한 뒤 비우기\n「취소」저장 없이 비우기"
    );
    if (wantSave) {
      if (!user?.id) {
        showToast("코스 저장은 로그인 후에 할 수 있어요.", "info", 2800);
      } else {
        await handleSaveMyOwnCourse(course, null);
      }
    }

    clearCourseSecondPickPulse();
    resetCourseSearch();
    setSelectedPlace(null);
    setAiSheetOpen(false);
  }, [
    selectedCourse,
    user?.id,
    handleSaveMyOwnCourse,
    showToast,
    clearCourseSecondPickPulse,
    resetCourseSearch,
  ]);

  useEffect(() => {
    if (!isCourseMode || !aiSheetOpen || courseOptions.length < 2) {
      return undefined;
    }
    const el = courseSwipeRowRef.current;
    if (!el || typeof el.addEventListener !== "function") return undefined;
    const onScrollEnd = () => {
      if (courseSwipeSettleTimerRef.current != null) {
        window.clearTimeout(courseSwipeSettleTimerRef.current);
        courseSwipeSettleTimerRef.current = null;
      }
      settleCourseFromSwipe();
    };
    el.addEventListener("scrollend", onScrollEnd, { passive: true });
    return () => el.removeEventListener("scrollend", onScrollEnd);
  }, [
    isCourseMode,
    aiSheetOpen,
    courseOptions.length,
    settleCourseFromSwipe,
  ]);

  /** 코스 시트 펼침 상태에서 아래로 슥 밀어 접기 (모바일) */
  useLayoutEffect(() => {
    if (
      !isCourseMode ||
      !String(query || "").trim() ||
      isAiSearching ||
      !aiSheetOpen
    ) {
      return undefined;
    }
    const nodes = [courseMergedHeaderRef.current, coursePullStripRef.current].filter(
      (n) => n instanceof HTMLElement
    );
    if (!nodes.length) return undefined;

    const state = { startY: 0, startX: 0, vertical: false };

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      state.startY = e.touches[0].clientY;
      state.startX = e.touches[0].clientX;
      state.vertical = false;
    };

    const onMove = (e) => {
      if (e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - state.startY;
      const dx = e.touches[0].clientX - state.startX;
      if (!state.vertical) {
        if (dy <= 10 || Math.abs(dx) >= dy) return;
        state.vertical = true;
      }
      if (state.vertical && dy > 0) {
        e.preventDefault();
      }
    };

    const onEnd = (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = t.clientY - state.startY;
      const dx = t.clientX - state.startX;
      const shouldClose =
        state.vertical && dy > 56 && dy > Math.abs(dx) * 0.85;
      state.vertical = false;
      if (shouldClose) {
        setAiSheetOpen(false);
      }
    };

    const passiveTrue = { passive: true };
    const passiveFalse = { passive: false };
    for (const el of nodes) {
      el.addEventListener("touchstart", onStart, passiveTrue);
      el.addEventListener("touchmove", onMove, passiveFalse);
      el.addEventListener("touchend", onEnd, passiveTrue);
      el.addEventListener("touchcancel", onEnd, passiveTrue);
    }
    return () => {
      for (const el of nodes) {
        el.removeEventListener("touchstart", onStart);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", onEnd);
        el.removeEventListener("touchcancel", onEnd);
      }
    };
  }, [isCourseMode, query, isAiSearching, aiSheetOpen]);

  useEffect(
    () => () => {
      const t = courseSwipeSettleTimerRef.current;
      if (t != null) window.clearTimeout(t);
    },
    []
  );

  useLayoutEffect(() => {
    if (
      !isCourseMode ||
      !aiSheetOpen ||
      !courseOptions?.length ||
      !selectedCourse
    ) {
      return;
    }
    const el = courseSwipeRowRef.current;
    if (!el) return;
    const idx = courseOptions.findIndex((c) => c.key === selectedCourse.key);
    if (idx < 0) return;
    const child = el.children[idx];
    if (!(child instanceof HTMLElement)) return;
    const host = el.getBoundingClientRect();
    const cr = child.getBoundingClientRect();
    const pad = 12;
    const needs = cr.left < host.left + pad || cr.right > host.right - pad;
    if (needs) {
      child.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [isCourseMode, aiSheetOpen, selectedCourse?.key, courseOptions]);

  useEffect(() => {
    let cancelled = false;
    const myKey = String(courseDrivingMap?.key ?? "");
    const dismissed = coursePathDismissedForCourseKeyRef.current;
    if (dismissed != null && dismissed !== myKey) {
      coursePathDismissedForCourseKeyRef.current = null;
    }
    const skipDismissed = () =>
      Boolean(myKey && coursePathDismissedForCourseKeyRef.current === myKey);

    if (myKey && skipDismissed()) {
      setCourseMapOverlay(null);
      return () => {
        cancelled = true;
      };
    }

    const base = buildCourseMapData(courseDrivingMap);
    if (!base?.polylinePath?.length) {
      setCourseMapOverlay(null);
      return undefined;
    }
    const a = base.polylinePath[0];
    const b = base.polylinePath[base.polylinePath.length - 1];

    if (!skipDismissed()) {
      setCourseMapOverlay({
        polylinePath: base.polylinePath,
        legLabel: base.legLabel,
        labelPosition: base.labelPosition,
        key: `${myKey}-straight`,
      });
    }

    fetchCourseWalkingRoute(a.lat, a.lng, b.lat, b.lng).then((route) => {
      if (cancelled) return;
      if (skipDismissed()) return;
      const straightM = getCourseLegMeters(courseDrivingMap);
      const fallbackStraight = () => {
        if (skipDismissed()) return;
        setCourseMapOverlay({
          polylinePath: base.polylinePath,
          legLabel: base.legLabel,
          labelPosition: base.labelPosition,
          key: `${myKey}-straight`,
        });
      };

      if (route?.ok && Array.isArray(route.path) && route.path.length >= 2) {
        const dm = Number(route.distanceMeters) || 0;
        const ds = Number(route.durationSeconds) || 0;
        const mid = route.path[Math.floor(route.path.length / 2)];
        const lp = {
          lat: Number(mid.lat),
          lng: Number(mid.lng),
        };
        const reasonable = isWalkingRouteReasonable({
          routedMeters: dm,
          straightMeters: straightM,
          durationSeconds: ds,
        });
        let legLabel;
        if (reasonable && dm > 0) {
          const walkMin = walkingRouteDisplayMinutes(dm, ds);
          const distStr =
            dm >= 1000 ? `약 ${(dm / 1000).toFixed(1)}km` : `약 ${Math.round(dm)}m`;
          legLabel = `길 따라 ${distStr} · 도보 약 ${walkMin}분`;
        } else if (dm > 0) {
          const walkMin = walkingRouteDisplayMinutes(dm, ds);
          const distStr =
            dm >= 1000 ? `약 ${(dm / 1000).toFixed(1)}km` : `약 ${Math.round(dm)}m`;
          legLabel = `보행 경로 ${distStr} · 도보 약 ${walkMin}분`;
        } else {
          legLabel = base.legLabel;
        }
        if (skipDismissed()) return;
        setCourseMapOverlay({
          polylinePath: route.path,
          legLabel,
          labelPosition: lp,
          key: `${myKey}-routed`,
        });
      } else {
        fallbackStraight();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [courseDrivingMap]);

  const previewPlaceRouteKey = useMemo(() => {
    if (!selectedPlace) return "";
    const id = selectedPlace.id != null ? String(selectedPlace.id) : "";
    const k =
      selectedPlace.place_id ??
      selectedPlace.kakao_place_id ??
      selectedPlace.kakaoId ??
      "";
    return `${id}:${String(k)}`;
  }, [selectedPlace]);

  useEffect(() => {
    const next = previewPlaceRouteKey;
    // 스와이프·X로 카드만 닫음: 지도 도착 경로는 그대로
    if (!next) {
      return;
    }
    const prevLast = lastPreviewPlaceRouteKeyRef.current;
    lastPreviewPlaceRouteKeyRef.current = next;
    if (prevLast && prevLast !== next) {
      arrivalWalkReqIdRef.current += 1;
      setArrivalWalkingOverlay(null);
    }
  }, [previewPlaceRouteKey]);

  const dismissArrivalWalkingOverlay = useCallback(() => {
    arrivalWalkReqIdRef.current += 1;
    setArrivalWalkingOverlay(null);
  }, []);

  const handleShowArrivalWalkingOnMap = useCallback(
    ({ fromLat, fromLng, toLat, toLng }) => {
      if (
        ![fromLat, fromLng, toLat, toLng].every((n) =>
          Number.isFinite(Number(n))
        )
      ) {
        showToast("좌표를 확인할 수 없어요.", "error", 2500);
        return;
      }
      const a = { lat: Number(fromLat), lng: Number(fromLng) };
      const b = { lat: Number(toLat), lng: Number(toLng) };
      const straightM = haversineMeters(a.lat, a.lng, b.lat, b.lng);
      const straightPath = [a, b];
      const distStr =
        straightM >= 1000
          ? `약 ${(straightM / 1000).toFixed(1)}km`
          : `약 ${Math.round(straightM)}m`;
      const walkStraightMin = Math.max(1, Math.round(straightM / 70));
      const mid = {
        lat: (a.lat + b.lat) / 2,
        lng: (a.lng + b.lng) / 2,
      };
      const reqId = ++arrivalWalkReqIdRef.current;
      setArrivalWalkingOverlay({
        polylinePath: straightPath,
        legLabel: `내 위치 → 도착 · 직선 ${distStr} · 도보 약 ${walkStraightMin}분`,
        labelPosition: mid,
        key: `${reqId}-straight`,
      });

      fetchCourseWalkingRoute(a.lat, a.lng, b.lat, b.lng).then((route) => {
        if (reqId !== arrivalWalkReqIdRef.current) return;

        const fallbackStraight = () => {
          if (reqId !== arrivalWalkReqIdRef.current) return;
          setArrivalWalkingOverlay({
            polylinePath: straightPath,
            legLabel: `내 위치 → 도착 · 직선 ${distStr} · 도보 약 ${walkStraightMin}분`,
            labelPosition: mid,
            key: `${reqId}-straight`,
          });
        };

        if (!route?.ok || !Array.isArray(route.path) || route.path.length < 2) {
          fallbackStraight();
          return;
        }
        const dm = Number(route.distanceMeters) || 0;
        const ds = Number(route.durationSeconds) || 0;
        const routeMid = route.path[Math.floor(route.path.length / 2)];
        const lp = {
          lat: Number(routeMid.lat),
          lng: Number(routeMid.lng),
        };
        const reasonable = isWalkingRouteReasonable({
          routedMeters: dm,
          straightMeters: straightM,
          durationSeconds: ds,
        });
        let legLabel;
        if (reasonable && dm > 0) {
          const walkMin = walkingRouteDisplayMinutes(dm, ds);
          const distStr2 =
            dm >= 1000 ? `약 ${(dm / 1000).toFixed(1)}km` : `약 ${Math.round(dm)}m`;
          legLabel = `내 위치 → 도착 · 길 따라 ${distStr2} · 도보 약 ${walkMin}분`;
        } else if (dm > 0) {
          const walkMin = walkingRouteDisplayMinutes(dm, ds);
          const distStr2 =
            dm >= 1000 ? `약 ${(dm / 1000).toFixed(1)}km` : `약 ${Math.round(dm)}m`;
          legLabel = `내 위치 → 도착 · 보행 ${distStr2} · 도보 약 ${walkMin}분`;
        } else {
          legLabel = `내 위치 → 도착 · 직선 ${distStr} · 도보 약 ${walkStraightMin}분`;
        }
        if (reqId !== arrivalWalkReqIdRef.current) return;
        setArrivalWalkingOverlay({
          polylinePath: route.path,
          legLabel,
          labelPosition: lp,
          key: `${reqId}-routed`,
        });
      });
    },
    [showToast]
  );

  useEffect(() => {
    if (!isCourseMode || !courseOptions?.length) return;
    /** 펄스 후보가 있으면 항상 kakaoPlaces를 후보로 유지(코스 1핀만으로 덮어쓰지 않음) */
    if (
      Array.isArray(courseSecondPulseMapPlaces) &&
      courseSecondPulseMapPlaces.length > 0
    ) {
      setKakaoPlaces(courseSecondPulseMapPlaces);
      return;
    }
    const driveKey = String(courseDrivingMap?.key ?? "");
    if (
      driveKey &&
      coursePathDismissedForCourseKeyRef.current === driveKey
    ) {
      const pickDismissed = courseDrivingMap ?? courseOptions[0];
      if (pickDismissed?.steps?.some((s) => s?.place)) {
        setKakaoPlaces(courseOptionsToMapPlaces([pickDismissed]));
      } else {
        setKakaoPlaces([]);
      }
      return;
    }
    const pick = courseDrivingMap ?? courseOptions[0];
    if (!pick?.steps?.length) return;

    setKakaoPlaces(courseOptionsToMapPlaces([pick]));
  }, [isCourseMode, courseDrivingMap, courseOptions, courseSecondPulseMapPlaces]);

  // 현재 위치 상태
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapLocationLoading, setMapLocationLoading] = useState(false);
  const [mapViewportCenterFromUser, setMapViewportCenterFromUser] =
    useState(null);

  const onMapViewportChange = useCallback(
    ({ lat, lng, bounds, level }) => {
      if (bounds?.sw && bounds?.ne) {
        lastMapBoundsRef.current = bounds;
      }
      if (typeof level === "number" && Number.isFinite(level)) {
        lastMapLevelRef.current = level;
      }
      if (bounds?.sw && bounds?.ne) {
        scheduleDbPlacesForBounds(bounds, level);
      }
      if (
        typeof lat === "number" &&
        Number.isFinite(lat) &&
        typeof lng === "number" &&
        Number.isFinite(lng)
      ) {
        setMapViewportCenterFromUser({ lat, lng });
      }
    },
    [scheduleDbPlacesForBounds]
  );

  useEffect(() => {
    if (String(query || "").trim()) {
      mapViewportLoadSeqRef.current += 1;
    }
  }, [query]);

  useEffect(() => {
    if (String(query || "").trim()) return;
    const b = lastMapBoundsRef.current;
    if (b?.sw && b?.ne) {
      scheduleDbPlacesForBounds(b, lastMapLevelRef.current);
    }
  }, [query, scheduleDbPlacesForBounds]);

  useEffect(() => {
    if (!dbCurators.length) return;
    const b = lastMapBoundsRef.current;
    if (b?.sw && b?.ne && !String(query || "").trim()) {
      scheduleDbPlacesForBounds(b, lastMapLevelRef.current);
    }
  }, [dbCurators.length, query, scheduleDbPlacesForBounds]);

  /** Supabase `places` UUID 행 — 미리보기 열린 뒤 상세만 추가 로드 */
  useEffect(() => {
    const place = selectedPlace;
    if (!place?.id) return;
    const sid = String(place.id);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)
    ) {
      return;
    }

    const seq = ++placeDetailRequestSeqRef.current;
    let cancelled = false;

    (async () => {
      try {
        const detail = await fetchPlaceDetail(sid);
        if (cancelled || seq !== placeDetailRequestSeqRef.current) return;
        setSelectedPlace((prev) => {
          if (!prev || String(prev.id) !== sid) return prev;
          return mergeDbPlaceDetailForPreview(prev, detail);
        });
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("fetchPlaceDetail:", e?.message ?? e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlace?.id]);

  const { checkinRanking, placeCheckinCounts } = useRealtimeCheckins();
  const rankingTop5 = useMemo(
    () => (Array.isArray(checkinRanking) ? checkinRanking.slice(0, 5) : []),
    [checkinRanking]
  );

  const [risingCurators, setRisingCurators] = useState([]);
  const loadRisingCurators = useCallback(async () => {
    const { data, error } = await supabase.rpc("home_rising_curators", {
      p_limit: 8,
    });
    if (error) {
      console.warn("home_rising_curators:", error.message);
      setRisingCurators([]);
      return;
    }
    setRisingCurators(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void loadRisingCurators();
  }, [loadRisingCurators, checkinRanking]);

  const handleRisingCuratorPick = useCallback((row) => {
    const u = String(row?.username ?? "").trim();
    if (!u) return;
    setShowSavedOnly(false);
    setLegendCategory(null);
    setShowAll(false);
    setSelectedCurators([canonicalCuratorChipToken(u, dbCurators)]);
  }, [dbCurators]);

  const hotRankTopPlaceIds = useMemo(
    () => new Set(rankingTop5.map((r) => String(r.place_id))),
    [rankingTop5]
  );

  /** 지도/검색으로 연 장소를 큐레이터 DB 카드와 병합할 때 사용 */
  const curatorPlaceCatalogForMerge = useMemo(
    () => [...dbPlaces, ...customPlaces],
    [dbPlaces, customPlaces]
  );

  const findSecondCandidateCourseForPlace = useCallback((pickPlace, courses) => {
    if (!pickPlace || !Array.isArray(courses) || !courses.length) return null;
    const want = placeId(pickPlace);
    if (want != null && String(want) !== "") {
      const byId = courses.find((c) => {
        const p2 = c?.steps?.[1]?.place;
        const id2 = placeId(p2);
        return id2 != null && String(id2) === String(want);
      });
      if (byId) return byId;
    }
    const name = String(pickPlace?.name ?? "").trim();
    if (name) {
      const byName = courses.find(
        (c) => String(c?.steps?.[1]?.place?.name ?? "").trim() === name
      );
      if (byName) return byName;
    }
    return courses[0] ?? null;
  }, []);

  /** 2차 후보 고르는 동안: 지도에서 연 카드(빈 곳·근처·마커)는 펄스 유지 — 검색·핫스트립 등만 펄스 종료 */
  const MAP_SOURCES_KEEP_SECOND_PULSE = useMemo(
    () =>
      new Set(["map_click", "map_nearby_pick", "map_empty_pick"]),
    []
  );

  const setSelectedPlaceWithAnalytics = useCallback(
    (place, clickSource = "map_click") => {
      if (
        place &&
        !place.courseSecondCandidatePick &&
        courseSecondPickMode &&
        !MAP_SOURCES_KEEP_SECOND_PULSE.has(String(clickSource || ""))
      ) {
        clearCourseSecondPickPulse();
      }
      const resolved = place
        ? mergePickedPlaceWithCuratorCatalog(place, curatorPlaceCatalogForMerge)
        : null;
      if (resolved && place?.courseSecondCandidatePick) {
        resolved.courseSecondCandidatePick = true;
        const matched = findSecondCandidateCourseForPlace(
          resolved,
          lastSecondCandidatesRef.current
        );
        const firstPlace = selectedCourse?.steps?.[0]?.place;
        let meters =
          matched?.steps?.[1]?.walkDistanceMeters != null &&
          Number.isFinite(matched.steps[1].walkDistanceMeters)
            ? Math.round(matched.steps[1].walkDistanceMeters)
            : null;
        const w0 = resolvePlaceWgs84(firstPlace);
        const w1 = resolvePlaceWgs84(resolved);
        if ((meters == null || meters <= 0) && w0 && w1) {
          meters = Math.round(haversineMeters(w0.lat, w0.lng, w1.lat, w1.lng));
        }
        if (Number.isFinite(meters) && meters > 0) {
          resolved.courseSecondDistanceFromFirstMeters = meters;
        } else {
          delete resolved.courseSecondDistanceFromFirstMeters;
        }
        const nm = String(
          firstPlace?.name ?? firstPlace?.place_name ?? ""
        ).trim();
        if (nm) {
          resolved.courseSecondFromFirstPlaceName = nm;
        } else {
          delete resolved.courseSecondFromFirstPlaceName;
        }
      } else if (resolved && !place?.courseSecondCandidatePick) {
        delete resolved.courseSecondDistanceFromFirstMeters;
        delete resolved.courseSecondFromFirstPlaceName;
      }
      if (resolved) {
        const sid = searchSessionIdRef.current;
        const placeId =
          resolved.id ??
          resolved.place_id ??
          resolved.kakao_place_id ??
          resolved.kakaoId;
        const placeName = resolved.name || resolved.place_name || "";
        let curatorId = resolved.curator_id ?? resolved.curatorId ?? null;
        if (
          !curatorId &&
          Array.isArray(resolved.curatorPlaces) &&
          resolved.curatorPlaces.length
        ) {
          const cp = resolved.curatorPlaces[0];
          curatorId = cp.curator_id ?? cp.curatorId ?? null;
        }
        if (sid && placeId != null && String(placeId) !== "") {
          insertPlaceClickLog({
            sessionId: sid,
            clickedPlaceId: placeId,
            clickedCuratorId: curatorId,
            placeName,
            source: clickSource,
            user,
          });
        }
      }
      setSelectedPlace(resolved);
    },
    [
      user,
      curatorPlaceCatalogForMerge,
      courseSecondPickMode,
      clearCourseSecondPickPulse,
      MAP_SOURCES_KEEP_SECOND_PULSE,
      findSecondCandidateCourseForPlace,
      selectedCourse,
    ]
  );

  const openCourseSecondFindModal = useCallback(() => {
    if (!selectedPlace || mapCourseFirstBusy) return;
    setCourseSecondFindVibes([]);
    setCourseSecondFindLiquors([]);
    setCourseSecondFindAnju([]);
    setCourseSecondFindPreferCloser(Boolean(courseQueryParsed?.walkable));
    setCourseSecondFindPrioritizeCurators(false);
    setCourseSecondFindMaxDistanceM(3000);
    setCourseSecondFindModalOpen(true);
  }, [selectedPlace, mapCourseFirstBusy, courseQueryParsed?.walkable]);

  const cancelCourseSecondFindModal = useCallback(() => {
    setCourseSecondFindModalOpen(false);
  }, []);

  useEffect(() => {
    if (!courseSecondFindModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") cancelCourseSecondFindModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [courseSecondFindModalOpen, cancelCourseSecondFindModal]);

  /** 지도 미리보기: 1차 반영 + 2차 후보만 계산·펄스(확정은 마커 탭 후 「2차는 여기로」) */
  const runMapCourseSecondFind = useCallback(
    async (userSecondPreferences) => {
      if (!selectedPlace || mapCourseFirstBusy) return;
      const merged = mergePickedPlaceWithCuratorCatalog(
        selectedPlace,
        curatorPlaceCatalogForMerge
      );
      if (!merged) return;
      setMapCourseFirstBusy(true);
      try {
        const pack = await applyMapPickAsFirstStepAsync(merged, {
          mapSearchQuery: query,
        });
        if (!pack?.ok) {
          showToast("지금은 코스에 담기 어려워요.", "error", 2800);
          return;
        }
        const prefs =
          userSecondPreferences && typeof userSecondPreferences === "object"
            ? userSecondPreferences
            : {};
        const radM = Number(prefs.maxSecondDistanceM);
        const kakaoSecondSearchRadius =
          Number.isFinite(radM) && radM > 0
            ? Math.min(5000, Math.max(400, radM))
            : 2200;
        const results = await computeSecondStepCandidatesOnly(
          pack.courseForSecond,
          pack.parsedForSecond,
          "same",
          {
            userSecondPreferences: prefs,
            /** 1차 주변 카카오 키워드로 풀 보강 — 지도에 보이는 포장마차·횟집 등 반영 */
            augmentPlacesWithKakaoNearFirst: true,
            kakaoSecondSearchRadius,
          }
        );
        const pulse = courseSecondCandidatesToPulseMapPlaces(results || []);
        if (pulse.length > 0) {
          lastSecondCandidatesRef.current = results || [];
          setCourseSecondPulseMapPlaces(pulse);
          setCourseSecondPickMode(true);
          setSelectedPlace(null);
          showToast(
            "주변 2차 후보가 깜빡여요. 마커를 눌러 골라 주세요.",
            "info",
            4200
          );
        } else {
          showToast("2차 후보를 찾지 못했어요.", "error", 2800);
        }
      } finally {
        setMapCourseFirstBusy(false);
      }
    },
    [
      selectedPlace,
      curatorPlaceCatalogForMerge,
      applyMapPickAsFirstStepAsync,
      computeSecondStepCandidatesOnly,
      showToast,
      mapCourseFirstBusy,
      query,
    ]
  );

  const confirmCourseSecondFindModal = useCallback(() => {
    setCourseSecondFindModalOpen(false);
    const prefs = {
      vibes: [...courseSecondFindVibes],
      liquorTypes: [...courseSecondFindLiquors],
      anjuHints: [...courseSecondFindAnju],
      preferCloser: courseSecondFindPreferCloser,
      prioritizeCurators: courseSecondFindPrioritizeCurators,
      maxSecondDistanceM: courseSecondFindMaxDistanceM,
    };
    void runMapCourseSecondFind(prefs);
  }, [
    courseSecondFindVibes,
    courseSecondFindLiquors,
    courseSecondFindAnju,
    courseSecondFindPreferCloser,
    courseSecondFindPrioritizeCurators,
    courseSecondFindMaxDistanceM,
    runMapCourseSecondFind,
  ]);

  const handleConfirmCourseSecondHere = useCallback(
    (pickPlace) => {
      const courses = lastSecondCandidatesRef.current;
      const picked = findSecondCandidateCourseForPlace(pickPlace, courses);
      if (!picked || !applySecondStepPick(picked)) {
        showToast("선택을 반영하지 못했어요.", "error", 2600);
        return;
      }
      clearCourseSecondPickPulse();
      setSelectedPlace(null);
      setAiSheetOpen(true);
      showToast("2차로 확정했어요. 길 안내를 확인해 보세요.", "success", 3200);
    },
    [
      findSecondCandidateCourseForPlace,
      applySecondStepPick,
      clearCourseSecondPickPulse,
      showToast,
    ]
  );

  /**
   * 지도 빈 곳 탭: 근처 Places → 있으면 카카오 장소 카드, 없으면 Geocoder + “못 찾음” 카드
   */
  const handleMapBlankPick = useCallback(
    async ({ lat, lng }) => {
      /** 2차 후보 고르는 중엔 빈 지도 탭으로 새 카드·지오코더 열지 않음 — 후보 마커 유지 */
      if (courseSecondPickMode) return;
      const resolved = await resolveMapClickVenue(lat, lng);
      if (resolved.kind === "place" && resolved.doc) {
        const shape = kakaoPlacesDocToMapClickPreview(resolved.doc);
        if (shape) {
          setSelectedPlaceWithAnalytics(shape, "map_nearby_pick");
        }
        return;
      }
      const geo = await mapClickCoordToPreviewPlace(resolved.lat, resolved.lng);
      if (geo) {
        setSelectedPlaceWithAnalytics(
          { ...geo, mapClickNoVenue: true },
          "map_empty_pick"
        );
      }
    },
    [setSelectedPlaceWithAnalytics, courseSecondPickMode]
  );

  const livePlaceIdsText = useMemo(() => {
    try {
      return Array.from(livePlaceIds || []).join(", ");
    } catch {
      return "";
    }
  }, [livePlaceIds]);

  useEffect(() => {
    let mounted = true;
    let cleanup = null;

    const reset = () => {
      if (!mounted) return;
      setLivePlaceIds(new Set());
    };

    const init = async () => {
      if (!user) {
        reset();
        return;
      }

      const { data, error } = await supabase
        .from("curator_live_sessions")
        .select("place_id")
        .eq("is_live", true);

      if (!mounted) return;

      if (error) {
        console.error("Failed to fetch curator_live_sessions:", error);
        reset();
      } else {
        const next = new Set(
          (Array.isArray(data) ? data : []).map((row) => String(row.place_id))
        );
        setLivePlaceIds(next);
      }

      const channel = supabase
        .channel("curator_live_sessions:live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "curator_live_sessions" },
          (payload) => {
            const newRow = payload?.new || null;
            const oldRow = payload?.old || null;
            const newPlaceId = newRow?.place_id != null ? String(newRow.place_id) : null;
            const oldPlaceId = oldRow?.place_id != null ? String(oldRow.place_id) : null;
            const newIsLive = Boolean(newRow?.is_live);

            setLivePlaceIds((prev) => {
              const next = new Set(prev);

              // If the old row was live, remove it first (handles updates or deletes)
              if (oldPlaceId && Boolean(oldRow?.is_live)) {
                next.delete(oldPlaceId);
              }

              // Add the new row if it's live
              if (newPlaceId && newIsLive) {
                next.add(newPlaceId);
              }

              return next;
            });
          }
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    };

    init();

    return () => {
      mounted = false;
      if (typeof cleanup === "function") cleanup();
    };
  }, [user]);

  useEffect(() => {
    if (!query.trim()) {
      // 검색어 비움: AI·검색 부가 상태만 정리. `selectedPlace`는 지우지 않음 —
      // 카카오 자동완성에서 확정 시 SearchBar가 query를 비우면서 미리보기(모달)를 유지해야 함.
      setAiError("");
      setAiSummary("");
      setAiReasons([]);
      setAiRecommendedIds([]);
      setAiSheetOpen(false);
      setSearchExpandUX(null);
      setSearchDistanceOrigin(null);
    }
  }, [query]);

  useEffect(() => {
    refreshStorage();
    refreshCustomPlaces();
  }, []);

  useEffect(() => {
    const refresh = () => refreshStorage();
    window.addEventListener("judo_storage_updated", refresh);
    return () => window.removeEventListener("judo_storage_updated", refresh);
  }, []);

  useEffect(() => {
    if (!isAiSearching) {
      setLoadingDots(".");
      return;
    }

    const frames = [".", "..", "..."];
    let index = 0;

    const timer = setInterval(() => {
      index = (index + 1) % frames.length;
      setLoadingDots(frames[index]);
    }, 350);

    return () => clearInterval(timer);
  }, [isAiSearching]);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      if (authLoading) return;
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      // 개발 환경에서는 VITE_ADMIN_USER_ID로 바로 admin 인식
      if (import.meta.env.DEV && import.meta.env.VITE_ADMIN_USER_ID === user.id) {
        console.log("🔧 개발 환경: Admin 계정 자동 인식");
        setIsAdmin(true);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("admin check error:", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data?.role === "admin");
      console.log("👑 Admin check 결과:", { userId: user.id, isAdmin: data?.role === "admin" });
    };

    const checkCurator = async () => {
      if (authLoading) return;
      if (!user?.id) {
        setIsCurator(false);
        setCuratorProfile(null);
        return;
      }

      console.log("Checking curator for user ID:", user.id); // 디버깅용

      const { data, error } = await supabase
        .from("curators")
        .select("*") // 모든 필드 가져오기
        .eq("user_id", user.id) // user_id로 조회
        .maybeSingle();

      console.log("Curator check result:", { data, error }); // 디버깅용

      if (cancelled) return;
      if (error) {
        console.error("curator check error:", error);
        setIsCurator(false);
        setCuratorProfile(null);
        return;
      }

      const isUserCurator = !!data;
      const wasCuratorBefore = curatorWelcomeRef.current;

      setIsCurator(isUserCurator);
      curatorWelcomeRef.current = isUserCurator;

      if (isUserCurator && !wasCuratorBefore) {
        console.log("🎉 새로운 큐레이터 환영 메시지 표시");

        const welcomeKey = `curator_welcome_${user.id}`;
        const hasShownWelcome = localStorage.getItem(welcomeKey);

        if (!hasShownWelcome) {
          setTimeout(() => {
            const emailPrefix = user?.email ? user.email.split('@')[0] : 'user';
            alert(`🎉 큐레이터가 되신 것을 환영합니다!\n\n이제 스튜디오에서 장소를 등록하고\n팔로워들과 멋진 장소를 공유할 수 있어요!\n\n스튜디오 입장 → @${emailPrefix} 버튼을 눌러서 입장하세요!`);
            localStorage.setItem(welcomeKey, 'shown');
          }, 1000);
        }

        setCuratorProfile({
          id: data.id,
          user_id: data.user_id,
          username: data.username,
          displayName: data.display_name,
          bio: data.bio,
          image: data.image
        });
        console.log("✅ 큐레이터 프로필 로드됨:", data.username);

        // 큐레이터 로그인 시 팔로우 알림 확인
        setTimeout(() => {
          checkUnreadFollowers(data.id);
        }, 1500);
      } else if (isUserCurator) {
        // 기존 큐레이터도 팔로우 알림 확인
        setCuratorProfile({
          id: data.id,
          user_id: data.user_id,
          username: data.username,
          displayName: data.display_name,
          bio: data.bio,
          image: data.image
        });

        setTimeout(() => {
          checkUnreadFollowers(data.id);
        }, 1500);
      }

      // 반려된 신청 확인 로직 (Strict Mode 이중 effect·병렬 checkCurator 대비)
      const checkRejectedApplication = async () => {
        try {
          const { data: rejectedRows, error } = await supabase
            .from("curator_applications")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "rejected")
            .order("created_at", { ascending: false })
            .limit(1);
          const rejectedApp = Array.isArray(rejectedRows) ? rejectedRows[0] : null;

          if (cancelled) return;

          if (error) {
            console.error("반려 신청 확인 오류:", error);
            return;
          }

          if (rejectedApp) {
            const rejectKey = `curator_rejected_${user.id}_${rejectedApp.id}`;
            if (localStorage.getItem(rejectKey)) return;

            // setTimeout 전에 예약: 동시에 두 번 돌아온 호출이 둘 다 alert를 잡지 않도록
            localStorage.setItem(rejectKey, "shown");

            setTimeout(() => {
              if (cancelled) return;
              const customReason =
                rejectedApp.rejection_reason &&
                String(rejectedApp.rejection_reason).trim();
              const reasonLine = customReason
                ? customReason
                : "검토 결과 큐레이터 신청 기준에 맞지 않아 반려되었습니다.";
              alert(
                `😔 큐레이터 신청이 반려되었습니다.\n\n신청자: ${rejectedApp.name}\n반려 사유: ${reasonLine}\n\n내용을 보완한 뒤 다시 신청하실 수 있습니다.`
              );
            }, 1500);
          }
        } catch (error) {
          console.error("반려 확인 중 오류:", error);
        }
      };

      checkRejectedApplication();
    };

    checkAdmin();
    checkCurator();
    
    // 모든 큐레이터 데이터 가져오기
    const loadCurators = async () => {
      try {
        const { data, error } = await supabase
          .from("curators")
          .select(
            "id, user_id, username, slug, name, display_name, bio, image, grade"
          )
          .order("created_at", { ascending: false });
          
        if (error) {
          console.error("큐레이터 로드 오류:", error);
          curatorAttachRowsRef.current = [];
          setDbCurators([]);
          return;
        }

        curatorAttachRowsRef.current = data || [];

        // CuratorFilterBar: 칩 키는 username → slug → display_name → name → id 순
        const formattedCurators = data.map((curator) => {
          const slug =
            curator.slug != null ? String(curator.slug).trim() : "";
          const u =
            curator.username != null ? String(curator.username).trim() : "";
          const d =
            curator.display_name != null
              ? String(curator.display_name).trim()
              : "";
          const nm =
            curator.name != null ? String(curator.name).trim() : "";
          const pk = curator.id != null ? String(curator.id).trim() : "";
          const userId =
            curator.user_id != null ? String(curator.user_id).trim() : "";
          const filterKey = u || slug || d || nm || pk;
          return {
            id: pk || filterKey,
            filterKey,
            name: filterKey,
            slug: slug || null,
            username: u || slug || null,
            userId: userId || null,
            displayName: d || nm || u || slug || "큐레이터",
            bio: curator.bio,
            avatar: curator.image,
            grade: curator.grade || "default",
            color: "#2ECC71",
          };
        });
        
        setDbCurators(formattedCurators);
        console.log("✅ 큐레이터 목록 로드:", formattedCurators.length, "개");
        console.log("📝 큐레이터 데이터:", formattedCurators); 
      } catch (error) {
        console.error("큐레이터 로드 실패:", error);
        curatorAttachRowsRef.current = [];
        setDbCurators([]);
      }
    };

    loadCurators();

    checkAdmin();
    checkCurator();
    
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  // 큐레이터 프로필 로드
  useEffect(() => {
    if (user && isCurator) {
      // 큐레이터 프로필 로드 (Supabase DB에서 직접)
      const loadCuratorProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('curators')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            console.error("큐레이터 프로필 조회 실패:", error);
            return;
          }
          
          if (data) {
            const profile = {
              id: data.id,
              user_id: data.user_id,
              username: data.username,
              displayName: data.display_name,
              bio: data.bio,
              image: data.avatar
            };
            
            setCuratorProfile(profile);
            console.log("🎭 큐레이터 프로필 로드:", profile);
          }
        } catch (error) {
          console.error("큐레이터 프로필 로드 실패:", error);
        }
      };
      
      loadCuratorProfile();
    }
  }, [user, isCurator]);

  const refreshMapUserProfile = useCallback(async () => {
    if (!user?.id) {
      setMapUserProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("username, display_name, auth_provider, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (!error && data) setMapUserProfile(data);
    else setMapUserProfile(null);
  }, [user?.id]);

  useEffect(() => {
    refreshMapUserProfile();
  }, [refreshMapUserProfile]);

  // Admin/큐레이터/일반 사용자에 따른 표시 로직
  const getDisplayUsername = () => {
    if (isAdmin) {
      return "admin"; // Admin은 항상 admin으로 표시
    }
    if (isCurator && curatorProfile?.username) {
      return curatorProfile.username; // 큐레이터는 큐레이터 이름으로 표시
    }
    if (!isCurator && mapUserProfile) {
      const nick = (mapUserProfile.display_name || "").trim();
      if (nick) return nick;
      const h = (mapUserProfile.username || "").trim();
      if (h) return h;
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return user?.user_metadata?.username || "user";
  };

  const getProfileButtonHint = () => {
    if (isAdmin) {
      return { title: "관리자", aria: "관리자 메뉴" };
    }
    if (isCurator && curatorProfile?.username) {
      const u = curatorProfile.username;
      return { title: `@${u}`, aria: `큐레이터 스튜디오 @${u}` };
    }
    const h = (mapUserProfile?.username || "").trim();
    const n = (mapUserProfile?.display_name || "").trim();
    if (n && h) {
      return {
        title: `${n} (@${h})`,
        aria: `프로필 ${n}, 핸들 @${h}`,
      };
    }
    if (h) return { title: `@${h}`, aria: `프로필 @${h}` };
    if (n) return { title: n, aria: `프로필 ${n}` };
    return {
      title: "프로필 (닉네임·핸들 설정)",
      aria: "지도 프로필 · 닉네임과 핸들은 프로필에서 설정",
    };
  };

  const searchBarProfilePhotoUrl = useMemo(() => {
    if (!user) return null;
    if (isCurator && curatorProfile?.image) {
      return String(curatorProfile.image).trim() || null;
    }
    const fromProfile = String(mapUserProfile?.avatar_url || "").trim();
    if (fromProfile) return fromProfile;
    const m = user.user_metadata || {};
    const raw = m.avatar_url || m.picture || m.image;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }, [user, isCurator, curatorProfile?.image, mapUserProfile?.avatar_url]);

  useEffect(() => {
    setSearchBarProfileImgFailed(false);
  }, [searchBarProfilePhotoUrl]);

  const getSearchBarProfileInitial = () => {
    const name = getDisplayUsername();
    if (!name || !String(name).length) return "?";
    return String(name).slice(0, 1).toUpperCase();
  };

  const getUserRole = () => {
    if (isAdmin) return "admin";
    if (isCurator) return "curator";
    return "user";
  };
  useEffect(() => {
    localStorage.removeItem("judo_custom_places");
    setCustomPlaces([]);

    // 최초 방문 확인
    const hasVisitedBefore = localStorage.getItem("judo_has_visited");
    const isFirstVisit = !hasVisitedBefore;
    
    if (isFirstVisit) {
      // 최초 방문이면 전체 선택
      setShowAll(true);
      setSelectedCurators([]);
      localStorage.setItem("judo_has_visited", "true");
      console.log("🎯 최초 방문: 전체 선택");
    } else {
      // 재방문이면 전체 선택 상태로 시작
      setShowAll(true);
      setSelectedCurators([]);
      console.log("🎯 재방문: 전체 선택 상태로 시작");
    }
  }, []);

  // 사용자 저장 장소 폴더 정보 로드
  const loadUserSavedPlaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUserSavedPlaces({});
        return;
      }

      // 임시: RPC 함수 없이 직접 쿼리
      const { data, error } = await supabase
        .from('user_saved_places')
        .select(`
          place_id,
          user_saved_place_folders(
            folder_key,
            system_folders(
              name,
              color,
              icon
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ 사용자 저장 장소 로드 실패:', error);
        setUserSavedPlaces({});
        return;
      }

      // place_id 기반으로 폴더 정보 맵핑
      const folderMap = {};
      data?.forEach(item => {
        const folders = item.user_saved_place_folders?.map(upf => ({
          key: upf.folder_key,
          name: upf.system_folders?.name,
          color: upf.system_folders?.color,
          icon: upf.system_folders?.icon
        })) || [];
        folderMap[item.place_id] = folders;
      });

      setUserSavedPlaces(folderMap);
      console.log('✅ 사용자 저장 장소 로드:', folderMap);
    } catch (error) {
      console.error('❌ 사용자 저장 장소 로드 중 오류:', error);
      setUserSavedPlaces({});
    }
  };

  // 페이지 로드 시 UI 초기화
  useEffect(() => {
    console.log("🔄 페이지 로드 - 데이터 초기화");
    setSelectedCurators([]);
    setShowAll(true);

    setTimeout(() => {
      console.log("🔍 dbCurators 데이터:", dbCurators.map(c => ({ id: c.id, name: c.name })));
    }, 1000);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    loadUserSavedPlaces();
  }, [authLoading, user?.id]);

  // 상태 변화 감지
  useEffect(() => {
    console.log("🔄 상태 변화:", { showAll, selectedCurators, dbCuratorsLength: dbCurators.length });
    console.log("📋 dbCurators 상세:", dbCurators);
  }, [showAll, selectedCurators, dbCurators]);

  /** 큐레이터 목록이 늦게 오면 닉네임으로만 저장된 선택을 user_id / id 로 맞춤 */
  useEffect(() => {
    if (!Array.isArray(dbCurators) || dbCurators.length === 0) return;
    setSelectedCurators((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const next = prev.map((s) =>
        canonicalCuratorChipToken(String(s ?? "").trim(), dbCurators)
      );
      const same =
        next.length === prev.length &&
        next.every((v, i) => v === String(prev[i] ?? "").trim());
      return same ? prev : next;
    });
  }, [dbCurators]);

  const refreshStorage = () => {
    setFolders(getFolders());
    setSavedMap(getSavedPlacesMap());
  };

  const refreshCustomPlaces = () => {
    // localStorage에 저장된 더미 데이터 정리
    localStorage.removeItem("judo_custom_places");
    setCustomPlaces([]); // 빈 배열로 설정
  };

  const allPlaces = useMemo(() => {
  const result = [...customPlaces, ...dbPlaces];
  console.log("📦 allPlaces 상태:", { 
    customPlacesLength: customPlaces.length, 
    dbPlacesLength: dbPlaces.length, 
    totalLength: result.length 
  });
  return result;
}, [customPlaces, dbPlaces]);

  const savedPlacesByFolder = useMemo(() => {
    const result = {};
    folders.forEach((folder) => {
      result[folder.id] = allPlaces.filter((place) => {
        const ids = savedMap[place.id] || [];
        return Array.isArray(ids) && ids.includes(folder.id);
      });
    });
    return result;
  }, [allPlaces, folders, savedMap]);

  const curatorColorMap = useMemo(() => {
    const map = {};
    dbCurators.forEach((c) => {
      map[c.name] = c.color;
    });
    return map;
  }, [dbCurators]);

  const savedColorMap = useMemo(() => {
    const map = {};
    allPlaces.forEach((p) => {
      map[p.id] = getPrimarySavedFolderColor(p.id, folders);
    });
    return map;
  }, [allPlaces, folders]);

  /** 병합 카드: UUID·카카오 id 등 여러 키로 저장 여부·폴더 색 조회 */
  const previewSavedState = useMemo(() => {
    if (!selectedPlace) return { isSaved: false, folderColor: undefined };
    const keys = [
      selectedPlace.id,
      selectedPlace.place_id,
      selectedPlace.kakao_place_id,
      selectedPlace.kakaoId,
    ]
      .filter((x) => x != null && x !== "")
      .map((x) => String(x));
    const uniq = [...new Set(keys)];
    let isSavedFlag = false;
    let folderColor;
    for (const k of uniq) {
      if (isPlaceSaved(k)) isSavedFlag = true;
      const c = getPrimarySavedFolderColor(k, folders);
      if (c && !folderColor) folderColor = c;
    }
    return { isSaved: isSavedFlag, folderColor };
  }, [selectedPlace, folders, savedMap]);

  const filteredByCuratorPlaces = useMemo(() => {
    // 노란별: 로그인 사용자 기준 «내가 저장한 장소만» (큐레이터=내 추천·비공개 포함 / 일반=폴더 저장)
    if (showSavedOnly) {
      if (!user) {
        return [];
      }

      if (isCurator) {
        const myUsername = curatorProfile?.username;
        const myPlaces = dbPlaces.filter((place) => {
          if (!Array.isArray(place.curatorPlaces)) return false;
          const byMode = place.curatorPlaces.some((cp) =>
            curatorPlaceMatchesLoggedInCurator(cp, curatorProfile, user.id)
          );
          if (byMode) return true;
          if (myUsername) {
            return place.curatorPlaces.some(
              (cp) => cp.curators?.username === myUsername
            );
          }
          return false;
        });
        console.log("⭐ 저장만 보기(큐레이터·내 추천·비공개 포함):", myPlaces.length);
        return myPlaces;
      }

      const savedKeySet = buildMergedSavedPlaceKeySet(savedMap, userSavedPlaces);
      const folderSaved = dbPlaces.filter((p) =>
        placeMatchesSavedKeySet(p, savedKeySet)
      );
      console.log("⭐ 저장만 보기(일반·로컬+Supabase):", folderSaved.length);
      return folderSaved;
    }

    const publicCuratorPlaces = (place) =>
      Boolean(place.curatorCount && place.curatorCount > 0);

    // 큐레이터 칩 미선택: «전체» on → 공개 큐레이터 추천만 / off → 빈 목록(버튼으로 끌 수 있게)
    if (selectedCurators.length === 0) {
      if (!showAll) return [];
      return dbPlaces.filter(publicCuratorPlaces);
    }

    // 선택된 큐레이터에 따라 필터링 (curator_id = curators.user_id, 칩=핸들 등 별칭 확장)
    const filtered = dbPlaces.filter((place) => {
      const placeKeys = buildPlaceCuratorFilterKeySet(place, dbCurators);
      return selectedCurators.some((selectedCurator) => {
        const want = expandCuratorChipSelectionKeys(selectedCurator, dbCurators);
        for (const w of want) {
          if (placeKeys.has(w)) return true;
        }
        return false;
      });
    });

    if (filtered.length === 0 && selectedCurators.length > 0) {
      const rescued = dbPlaces.filter((place) =>
        selectedCurators.some((rawSel) => {
          const row = findDbCuratorRowForChip(rawSel, dbCurators);
          if (!row) return false;
          const ids = collectCuratorIdsForRescueMatch(row);
          return (place.curatorPlaces || []).some((cp) => {
            const cid = String(cp.curator_id ?? "").trim().toLowerCase();
            if (!cid) return false;
            const cCompact = cid.replace(/-/g, "");
            return ids.has(cid) || ids.has(cCompact);
          });
        })
      );
      if (rescued.length > 0) return rescued;
    }

    return filtered;
  }, [
    showSavedOnly,
    showAll,
    selectedCurators,
    dbPlaces,
    dbCurators,
    user,
    isCurator,
    curatorProfile?.id,
    curatorProfile?.user_id,
    savedMap,
    userSavedPlaces,
  ]);

  const curatorSpotlightPlaces = useMemo(() => {
    return [...dbPlaces]
      .filter((p) => (p.curatorCount || 0) >= 1)
      .sort((a, b) => (b.curatorCount || 0) - (a.curatorCount || 0))
      .slice(0, 12);
  }, [dbPlaces]);

  // 외부 데이터를 저장할 상태 추가
  const [externalPlaces, setExternalPlaces] = useState([]);

  const displayedPlaces = useMemo(() => {
    if (!query.trim()) return filteredByCuratorPlaces;
    if (aiRecommendedIds.length === 0) return filteredByCuratorPlaces;

    const idSet = new Set(aiRecommendedIds.map(String));
    const idOrderMap = new Map(
      aiRecommendedIds.map((id, index) => [String(id), index])
    );

    // 외부 데이터에서 AI 추천 장소 찾기
    const externalRecommendedPlaces = externalPlaces
      .filter((place) => idSet.has(String(place.id)))
      .sort(
        (a, b) => idOrderMap.get(String(a.id)) - idOrderMap.get(String(b.id))
      );

    // 내부 데이터에서 AI 추천 장소 찾기
    const internalRecommendedPlaces = filteredByCuratorPlaces
      .filter((place) => idSet.has(String(place.id)))
      .sort(
        (a, b) => idOrderMap.get(String(a.id)) - idOrderMap.get(String(b.id))
      );

    // 네이버 장소는 AI 추천 ID가 없어도 무조건 표시 (ID가 'naver_'로 시작하는 경우)
    const naverPlaces = externalPlaces.filter((place) => 
      String(place.id).startsWith('naver_')
    );

    // 외부 데이터 우선, 내부 데이터 보조, 네이버 장소 추가
    const finalPlaces = [
      ...externalRecommendedPlaces,
      ...internalRecommendedPlaces,
      ...naverPlaces,
    ];
    const deduped = [];
    const seenId = new Set();
    for (const p of finalPlaces) {
      const id = String(p?.id ?? "");
      if (!id || seenId.has(id)) continue;
      seenId.add(id);
      deduped.push(p);
    }

    if (import.meta.env.DEV) {
      console.log("🔍 displayedPlaces(추천 id만):", deduped.length, {
        external: externalRecommendedPlaces.length,
        internal: internalRecommendedPlaces.length,
        naver: naverPlaces.length,
        aiIdCount: aiRecommendedIds.length,
      });
    }
    return deduped;
  }, [filteredByCuratorPlaces, aiRecommendedIds, query, externalPlaces]);

  /** 2차 픽 모드: 카드 열 때마다 새 배열을 만들면 MapView `places`가 매번 바뀌어 펄스 interval이 끊김 */
  const courseSecondPulsePlacesForMap = useMemo(() => {
    if (
      !courseSecondPickMode ||
      !Array.isArray(courseSecondPulseMapPlaces) ||
      courseSecondPulseMapPlaces.length === 0
    ) {
      return null;
    }
    return courseSecondPulseMapPlaces.map((p) => ({ ...p }));
  }, [courseSecondPickMode, courseSecondPulseMapPlaces]);

  const mapDisplayedPlacesWithLegend = useMemo(() => {
    const mergePlaces = (basePlaces, extraPlaces) => {
      const merged = [...basePlaces, ...extraPlaces];
      const seen = new Set();
      return merged.filter((place) => {
        const key = String(place?.id ?? `${place?.name}_${place?.lat}_${place?.lng}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    /** 칩으로 특정 큐레이터만 볼 때: 카카오 검색·자동완성·타이핑 핀은 끄고 `displayedPlaces`(DB 필터)만 지도에 표시 */
    const curatorPinsOnly =
      !isCourseMode &&
      Array.isArray(selectedCurators) &&
      selectedCurators.length > 0 &&
      !showSavedOnly;
    const kPins = curatorPinsOnly ? [] : kakaoPlaces;
    const kTypingPins = curatorPinsOnly ? [] : kakaoTypingPreviewPlaces;

    // 별표 버튼(showSavedOnly)이 켜져 있으면 모든 장소 표시 (큐레이터 기능)
    if (showSavedOnly) {
      if (import.meta.env.DEV) {
        console.log("⭐ mapDisplayedPlacesWithLegend (저장만):", displayedPlaces.length);
      }
      // 동일 id면 검색/카카오 쪽(isKakaoPlace)이 먼저 오도록 — 앞선 항목이 병합 시 유지됨
      return appendSelectedPlacePinIfMissing(
        applyLegendCategoryFilter(
          dedupeMapPlacesByKakaoId(
            mergePlaces(mergePlaces(kPins, displayedPlaces), kTypingPins)
          ),
          legendCategory
        ),
        selectedPlace
      );
    }

    // 코스 모드: 코스 핀만(없으면 빈 지도 — 일반 검색 마커와 섞이지 않게)
    if (isCourseMode) {
      if (!courseError && Array.isArray(courseOptions) && courseOptions.length > 0) {
        /** 2차 후보 고르는 중엔 펄스 전용 스냅샷 사용(미리보기 열어도 깜빡임 유지) */
        if (courseSecondPulsePlacesForMap) {
          return appendSelectedPlacePinIfMissing(
            applyLegendCategoryFilter(
              courseSecondPulsePlacesForMap,
              legendCategory
            ),
            selectedPlace
          );
        }
        return appendSelectedPlacePinIfMissing(
          applyLegendCategoryFilter(
            dedupeMapPlacesByKakaoId([...kakaoPlaces]),
            legendCategory
          ),
          selectedPlace
        );
      }
      return appendSelectedPlacePinIfMissing(
        applyLegendCategoryFilter(dedupeMapPlacesByKakaoId([]), legendCategory),
        selectedPlace
      );
    }

    // AI/검색 결과가 있어도 기존 마커는 유지하고 검색 마커를 추가 표시
    if (aiRecommendedIds.length > 0 || query.trim()) {
      const filteredBase = displayedPlaces.filter((place) => place.is_public !== false);
      const merged = mergePlaces(
        mergePlaces(kPins, filteredBase),
        kTypingPins
      );
      if (import.meta.env.DEV) {
        console.log("🔍 AI+기존 마커 병합:", merged.length, {
          base: filteredBase.length,
          kakao: kPins.length,
        });
      }
      return appendSelectedPlacePinIfMissing(
        applyLegendCategoryFilter(dedupeMapPlacesByKakaoId(merged), legendCategory),
        selectedPlace
      );
    }
    
    // 일반 모드에서는 비공개 필터링 적용
    const filtered = displayedPlaces.filter(place => {
      // 큐레이터는 자신의 장소와 공개 장소만 볼 수 있음
      if (isCurator) {
        return place.is_public !== false; // false가 아닌 것만 (공개 + undefined)
      }
      // 일반 사용자는 공개 장소만 볼 수 있음
      return place.is_public !== false;
    });
    if (import.meta.env.DEV) {
      console.log("🗺️ 일반 모드 지도 장소(필터 후):", filtered.length);
    }

    const result = dedupeMapPlacesByKakaoId(
      mergePlaces(mergePlaces(kPins, filtered), kTypingPins)
    ); // 동일 id면 kakaoPlaces·DB가 타이핑 미리보기보다 우선; 카카오 숫자 id로 이중 마커 제거
    if (import.meta.env.DEV) {
      console.log("🗺️ mapDisplayedPlacesWithLegend 최종:", result.length);
    }

    return appendSelectedPlacePinIfMissing(
      applyLegendCategoryFilter(result, legendCategory),
      selectedPlace
    );
  }, [
    displayedPlaces,
    showSavedOnly,
    isCurator,
    kakaoPlaces,
    kakaoTypingPreviewPlaces,
    aiRecommendedIds,
    query,
    legendCategory,
    isCourseMode,
    courseError,
    courseOptions,
    selectedCurators,
    courseSecondPulsePlacesForMap,
    selectedPlace,
  ]);

  // 카카오 자동완성 후보가 전국·광역으로 퍼질 수 있어 fitToPlaces(setBounds)를 쓰면
  // 타이핑만 해도 지도가 줌아웃됨. 검색어가 있을 땐 MapView `preserveViewportOnPlacesChange`로
  // 마커만 갱신하고 줌/센터는 유지.

const topReasonMap = useMemo(() => {
  const map = {};
  aiReasons.forEach((item) => {
    if (item?.placeId && item?.reason) {
      map[item.placeId] = item.reason;
    }
  });
  return map;
}, [aiReasons]);

  const searchResultSheetExtras = useMemo(() => {
    const q = String(query || "").trim();
    if (!q) return { parsed: null, byId: new Map() };
    const parsed = parseSearchQuery(q);
    const byId = new Map();
    for (const p of displayedPlaces) {
      const id = String(p.id);
      byId.set(id, {
        matched:
          Array.isArray(p.matchedFacetLabels) && p.matchedFacetLabels.length > 0
            ? p.matchedFacetLabels
            : matchedQueryFacetLabels(p, parsed),
        rep:
          p.searchRepresentativeTag ||
          representativePlaceTag({
            ...p,
            atmosphere:
              p.atmosphere || getAtmosphereFromCategory(p.category_name),
          }),
        why:
          p.whyRecommended || buildRecommendationWhyLine(p, parsed),
      });
    }
    return { parsed, byId };
  }, [displayedPlaces, query]);

  const curatorSearchHighlightList = useMemo(
    () => buildCuratorSearchHighlights(query, dbPlaces, dbCurators),
    [query, dbPlaces, dbCurators]
  );

  const getRecommendationListDistanceLabel = useCallback(
    (place) => {
      const origin = searchDistanceOrigin;
      let meters =
        typeof place.distance === "number" &&
        Number.isFinite(place.distance) &&
        place.distance > 0
          ? Math.round(place.distance)
          : null;

      const lat = parseFloat(place.y ?? place.lat);
      const lng = parseFloat(place.x ?? place.lng);
      if (
        meters == null &&
        origin &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        meters = Math.round(
          calculateDistance(origin.lat, origin.lng, lat, lng)
        );
      }

      if (meters == null || !Number.isFinite(meters) || meters <= 0) {
        return null;
      }

      const walkMin =
        typeof place.walkingTime === "number" &&
        Number.isFinite(place.walkingTime) &&
        place.walkingTime > 0
          ? Math.round(place.walkingTime)
          : Math.max(1, Math.round(meters / 67));

      const distStr =
        meters >= 1000
          ? `${parseFloat((meters / 1000).toFixed(1))}km`
          : `${meters}m`;

      return `🚶 ${distStr} · 도보 약 ${walkMin}분`;
    },
    [searchDistanceOrigin]
  );

const handleClearSearch = () => {
  searchSessionIdRef.current = null;
  setQuery("");
  setSelectedPlace(null);
  setKakaoPlaces([]); // 카카오 장소들도 정리
  setKakaoTypingPreviewPlaces([]);
  setAiError("");
  setAiSummary("");
  setAiReasons([]);
  setAiRecommendedIds([]);
  setAiSheetOpen(false);
  setSimpleMapSearchMarkersOnly(false);
  setIsAiSearching(false);
  setSearchLoadingLabel("");
  setSearchExpandUX(null);
  setYajangFallbackBanner(null);
  setSearchDistanceOrigin(null);
  setMapViewportCenterFromUser(null);
  setShowMapSearchHereButton(false);
  searchHereArmedRef.current = false;
  setMapViewportSearchLock(false);
  setRegionBoundaryOverlay(null);
  resetCourseSearch();
};

  // 카카오 자동완성 클릭·엔터: 지도 이동 + 확정 마커 + 미리보기 카드
  const handleKakaoPlaceSelect = useCallback(
    (kakaoPlace) => {
      if (!kakaoPlace || kakaoPlace.id == null) return;

      const lat = parseFloat(kakaoPlace.y);
      const lng = parseFloat(kakaoPlace.x);
      const formattedPlace = {
        id: `kakao_${kakaoPlace.id}`,
        name: kakaoPlace.place_name,
        place_name: kakaoPlace.place_name,
        address: kakaoPlace.road_address_name || kakaoPlace.address_name,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        x: kakaoPlace.x != null ? String(kakaoPlace.x) : undefined,
        y: kakaoPlace.y != null ? String(kakaoPlace.y) : undefined,
        category: kakaoPlace.category_name,
        phone: kakaoPlace.phone,
        kakao_place_id: kakaoPlace.id,
        isKakaoPlace: true,
        isLive: true,
        place_url: kakaoPlace.place_url,
        category_name: kakaoPlace.category_name,
        road_address_name: kakaoPlace.road_address_name,
        address_name: kakaoPlace.address_name,
        distance: kakaoPlace.distance,
      };

      setKakaoTypingPreviewPlaces([]);

      const merged = mergePickedPlaceWithCuratorCatalog(
        formattedPlace,
        curatorPlaceCatalogForMerge
      );
      const wPick = resolvePlaceWgs84(formattedPlace);
      const wMerged = resolvePlaceWgs84(merged);
      const w = wMerged || wPick;
      const forMap =
        w != null
          ? {
              ...merged,
              lat: w.lat,
              lng: w.lng,
              x: String(w.lng),
              y: String(w.lat),
            }
          : merged;

      setKakaoPlaces((prev) => {
        const kid = normalizeKakaoPlaceId(forMap);
        if (kid) {
          const hit = prev.some((p) => normalizeKakaoPlaceId(p) === kid);
          if (hit) {
            return prev.map((p) =>
              normalizeKakaoPlaceId(p) === kid ? { ...p, ...forMap } : p
            );
          }
          return [...prev, { ...forMap, isLive: true, isKakaoPlace: true }];
        }
        const exists = prev.some((p) => String(p?.id) === String(forMap.id));
        if (exists) {
          return prev.map((p) =>
            String(p?.id) === String(forMap.id) ? { ...p, ...forMap } : p
          );
        }
        return [...prev, { ...forMap, isLive: true, isKakaoPlace: true }];
      });

      setSelectedPlaceWithAnalytics(forMap, "kakao_autocomplete");
      /** 지도 이동은 MapView `selectedPlace` effect(카드 높이만큼 pan 보정)에 맡김 — 여기서 setCenter를 반복하면 보정이 깨짐 */
    },
    [
      curatorPlaceCatalogForMerge,
      setSelectedPlaceWithAnalytics,
    ]
  );

  /** 검색바 엔터/검색 버튼으로 나온 결과: 첫 장소에 핀과 동시에 미리보기 카드 */
  const openPreviewForFirstSearchResult = useCallback(
    (kakaoFormattedPlaces, analyticsSource = "search_bar_submit") => {
      if (
        !Array.isArray(kakaoFormattedPlaces) ||
        kakaoFormattedPlaces.length === 0
      ) {
        return;
      }
      const first = kakaoFormattedPlaces[0];
      const merged = mergePickedPlaceWithCuratorCatalog(
        first,
        curatorPlaceCatalogForMerge
      );
      setSelectedPlaceWithAnalytics(merged, analyticsSource);
    },
    [curatorPlaceCatalogForMerge, setSelectedPlaceWithAnalytics]
  );

  // 쾌속 잔 채우기 핸들러 (커스텀 오버레이에서 호출)
  const handleQuickSave = (place) => {
    console.log('📍 쾌속 잔 채우기 요청:', place);
    
    // PlacePreviewCard의 로직과 동일하게 처리
    // localStorage에 저장하는 로직을 구현해야 함
    // 임시로 alert로 처리
    alert('쾌속 잔 채우기 기능은 개발 중입니다.');
  };

  const handleSearchSubmit = async (value) => {
    const nextQuery = value.trim();
    const naturalQ = parseNaturalQuery(nextQuery);
    const namesGeographicArea =
      Boolean(naturalQ.region) || Boolean(findAreaKeywordInQuery(nextQuery));
    const explicitNearMe =
      /내\s*위치|내\s*근처|내\s*주변|여기\s*근처|현재\s*위치/i.test(nextQuery);
    const vagueNear = /근처|주변/.test(nextQuery);
    /** `parseNaturalQuery`의 도보 의도(걸어·가까운 등) + 문장형(걸어가기 좋은) */
    const walkIntent =
      Boolean(naturalQ.wantsWalkingDistance) ||
      /걸어서|도보|걸어가기|걸어갈|걸어다니기/i.test(nextQuery);

    /** 미리보기로 연 장소를 기준점으로 쓰고 싶을 때(지도 핀·카드가 열린 상태) */
    const anchorFromSelectedPlaceIntent =
      /여기서|여기\s*기준|이\s*곳에서|이\s*장소|선택한\s*곳|지금\s*핀|지도에서\s*고른|열린\s*카드/i.test(
        nextQuery
      );
    const selectedPlaceSnapshot = anchorFromSelectedPlaceIntent
      ? selectedPlace
      : null;
    const searchAnchorCoords = resolvePlaceWgs84(selectedPlaceSnapshot);
    const hasSearchPinAnchor = Boolean(searchAnchorCoords);

    const shouldUseLocationSearch =
      !namesGeographicArea &&
      (isLocationBasedSearch ||
        explicitNearMe ||
        walkIntent ||
        vagueNear ||
        hasSearchPinAnchor);

    /** UI에서 '내 주변'을 켠 경우에만 GPS 우선(렌더 시점 값 — 아래 setState 전에 캡처) */
    const userPinnedLocationSearchMode = isLocationBasedSearch;

    setQuery(nextQuery);
    
    // 검색 시작 시 모든 상태 초기화
    setSelectedPlace(null);
    setAiError("");
    setAiSummary("");
    setAiReasons([]);
    setAiRecommendedIds([]);
    setAiSheetOpen(false);
    setSimpleMapSearchMarkersOnly(false);
    setRegionBoundaryOverlay(null);

    // 이전 검색 결과 강제 초기화
    setExternalPlaces([]);
    setKakaoPlaces([]);
    setKakaoTypingPreviewPlaces([]);
    setBlogReviews([]);
    setSearchExpandUX(null);
    setYajangFallbackBanner(null);
    setSearchDistanceOrigin(null);
    resetCourseSearch();

    console.log('🧹 모든 검색 상태 초기화 완료');

    if (!nextQuery) return;

    const searchSessionId = crypto.randomUUID();
    searchSessionIdRef.current = searchSessionId;

    const searchUiStartedAt = Date.now();
    const MIN_SEARCH_LOADING_MS = 1800;
    let shouldOpenAiSheetAfterLoad = false;
    let searchHadError = false;
    let searchResultIdsForLog = [];
    let searchModeForLog = shouldUseLocationSearch ? "nearby" : "map";
    const useBasicSearchPipeline = homeSearchChannel === "basic";
    if (useBasicSearchPipeline) {
      searchModeForLog = `${searchModeForLog}_basic`;
    }
    let skipMinSearchLoading = useBasicSearchPipeline;

    try {
      setIsAiSearching(true);
      setSearchLoadingLabel(
        useBasicSearchPipeline
          ? "장소 검색 중…"
          : getSearchLoadingMessage(nextQuery)
      );

      if (isCourseQuery(nextQuery)) {
        const res = await runCourseSearch(nextQuery);
        if (res.handled) {
          searchModeForLog = "course";
          setExternalPlaces([]);
          setAiRecommendedIds([]);
          searchResultIdsForLog = [
            ...new Set(
              (res.options || []).flatMap((c) =>
                (c.steps || []).map((s) => String(s.place?.id ?? "")).filter(Boolean)
              ),
            ),
          ];
          shouldOpenAiSheetAfterLoad = true;
          setAiSummary(
            res.options?.length
              ? "큐레이터·태그·거리 기준으로 짠 2단계 코스예요."
              : ""
          );
        }
        return;
      }

      const intentAssistPromise = useBasicSearchPipeline
        ? Promise.resolve(null)
        : Promise.race([
            fetchSearchIntentAssist(nextQuery),
            new Promise((resolve) =>
              setTimeout(() => resolve(null), SEARCH_INTENT_ASSIST_MS)
            ),
          ]);

      // 검색 모드에 따라 다르게 처리
      if (shouldUseLocationSearch) {
        // 내 위치 중심 검색 (빨강 핀 클릭 후) - 위치 기반 검색
        console.log("🔍 내 위치 중심 검색 시작:", nextQuery);

        const resolveNearbySearchOrigin = async () => {
          if (searchAnchorCoords) {
            return {
              lat: searchAnchorCoords.lat,
              lng: searchAnchorCoords.lng,
            };
          }
          // "이 근처·근처·주변"만 쓴 경우: 지도에 맞춰 본 위치가 기준 (GPS는 내 위치 모드일 때만 우선)
          const useDeviceGps =
            explicitNearMe || userPinnedLocationSearchMode;
          if (!useDeviceGps) {
            const mc = mapRef.current?.getCenter?.();
            if (
              mc &&
              Number.isFinite(Number(mc.lat)) &&
              Number.isFinite(Number(mc.lng))
            ) {
              return { lat: Number(mc.lat), lng: Number(mc.lng) };
            }
            if (
              mapViewportCenterFromUser &&
              Number.isFinite(mapViewportCenterFromUser.lat) &&
              Number.isFinite(mapViewportCenterFromUser.lng)
            ) {
              return {
                lat: mapViewportCenterFromUser.lat,
                lng: mapViewportCenterFromUser.lng,
              };
            }
          }
          const clat = currentLocation?.lat;
          const clng = currentLocation?.lng;
          if (
            clat != null &&
            clng != null &&
            Number.isFinite(Number(clat)) &&
            Number.isFinite(Number(clng))
          ) {
            return { lat: Number(clat), lng: Number(clng) };
          }
          return getCurrentUserLocation();
        };

        const [userLocation, intentAssist] = await Promise.all([
          resolveNearbySearchOrigin(),
          intentAssistPromise,
        ]);
        console.log("📍 주변 검색 기준 좌표:", userLocation, {
          fromSelectedPlaceCard: Boolean(searchAnchorCoords),
          preferDeviceGps: Boolean(
            explicitNearMe || userPinnedLocationSearchMode
          ),
        });
        setSearchDistanceOrigin({
          lat: userLocation.lat,
          lng: userLocation.lng,
        });

        const kakaoHint =
          intentAssist?.kakaoKeywordHint &&
          String(intentAssist.kakaoKeywordHint).trim();
        let nearbyKeyword = kakaoHint || nextQuery;
        let nearbyPlaces = await mergeNearbyKakaoForOrQuery(
          nearbyKeyword,
          userLocation
        );
        if (
          nearbyPlaces.length === 0 &&
          kakaoHint &&
          kakaoHint !== nextQuery.trim()
        ) {
          nearbyPlaces = await mergeNearbyKakaoForOrQuery(
            nextQuery,
            userLocation
          );
        }
        if (
          nearbyPlaces.length === 0 &&
          !useBasicSearchPipeline &&
          intentAssist?.broadKakaoKeyword &&
          String(intentAssist.broadKakaoKeyword).trim() &&
          String(intentAssist.broadKakaoKeyword).trim() !==
            String(nearbyKeyword || "").trim()
        ) {
          nearbyPlaces = await mergeNearbyKakaoForOrQuery(
            String(intentAssist.broadKakaoKeyword).trim(),
            userLocation
          );
        }
        nearbyPlaces = filterPlacesByParsedIntent(
          nearbyPlaces,
          naturalQ.facets || parseSearchQuery(nextQuery),
          nextQuery,
          { curatorCatalogForYajang: curatorPlaceCatalogForMerge }
        );
        console.log('🍺 위치 기반 검색 결과:', nearbyPlaces.length, {
          keyword: nearbyKeyword,
          intentAssist: !!intentAssist,
        });

        // 3. AI 스코어링 + 결과 없으면 확장 쿼리로 자동 1~2회 재시도
        let scoredPlaces = calculateLocalAIScores(nearbyPlaces, nextQuery, userLocation);
        let relaxationUsed = null;
        if (scoredPlaces.length === 0) {
          const parsedEmpty = naturalQ.facets;
          const expandPack = buildExpansionSuggestions(
            nextQuery,
            parsedEmpty,
            intentAssist
          );
          for (const rq of expandPack.autoRetryQueries) {
            const r = String(rq || "").trim();
            if (!r) continue;
            const np = await searchNearbyBars(r, userLocation);
            const npFiltered = filterPlacesByParsedIntent(
              np,
              naturalQ.facets || parseSearchQuery(nextQuery),
              nextQuery,
              { curatorCatalogForYajang: curatorPlaceCatalogForMerge }
            );
            const sp = calculateLocalAIScores(npFiltered, nextQuery, userLocation);
            if (sp.length > 0) {
              scoredPlaces = sp;
              relaxationUsed = r;
              break;
            }
          }
          if (scoredPlaces.length === 0) {
            setSearchExpandUX({
              headline: expandPack.headline,
              subline: expandPack.subline,
              dataNote: expandPack.dataNote,
              fallbackHints: expandPack.fallbackHints,
              suggestions: expandPack.suggestions,
              quickBroadenQuery: expandPack.quickBroadenQuery,
              quickBroadenLabel: expandPack.quickBroadenLabel,
              originalQuery: nextQuery,
            });
          } else {
            setSearchExpandUX(null);
            showToast(
              `범위를 넓혀 «${relaxationUsed}»(으)로 찾았어요`,
              "info",
              4200
            );
          }
        } else {
          setSearchExpandUX(null);
        }

        let yajangBannerPayloadNear = null;
        if (scoredPlaces.length === 0) {
          const fbNear = applyYajangCuratorFallbackIfEmpty(
            userLocation,
            curatorPlaceCatalogForMerge,
            nextQuery,
            scoredPlaces
          );
          if (fbNear.usedFallback) {
            scoredPlaces = fbNear.scoredPlaces;
            setSearchExpandUX(null);
            yajangBannerPayloadNear = fbNear.banner;
            setYajangFallbackBanner(fbNear.banner);
          }
        } else {
          setYajangFallbackBanner(null);
        }

        console.log('🎯 AI 최종 추천:', scoredPlaces.length, relaxationUsed || "");

        const anchorKakaoId = selectedPlaceSnapshot
          ? normalizeKakaoPlaceId(selectedPlaceSnapshot)
          : null;
        const withoutSelf =
          anchorKakaoId != null
            ? scoredPlaces.filter(
                (p) => normalizeKakaoPlaceId(p) !== anchorKakaoId
              )
            : scoredPlaces;
        if (withoutSelf.length < scoredPlaces.length) {
          scoredPlaces = withoutSelf;
        }

        // 결과 설정 (리스트·병합 시에도 빨간 핀 플래그 유지)
        setExternalPlaces(
          scoredPlaces.map((p) => ({ ...p, isKakaoPlace: true }))
        );
        const intentLineNear = (() => {
          const s = intentAssist?.intentSummary && String(intentAssist.intentSummary).trim();
          if (!s) return "";
          return s.length > 42 ? `${s.slice(0, 42)}…` : s;
        })();
        setAiSummary(
          yajangBannerPayloadNear
            ? `5km 안 큐레이터 야장 ${scoredPlaces.length}곳 · ${nextQuery.slice(0, 18)}${nextQuery.length > 18 ? "…" : ""}`
            : searchAnchorCoords
              ? intentLineNear
                ? `선택 장소 기준 · ${nextQuery.slice(0, 16)}${nextQuery.length > 16 ? "…" : ""} · ${intentLineNear}`
                : `선택 장소 기준 도보권 · ${nextQuery.slice(0, 22)}${nextQuery.length > 22 ? "…" : ""}`
              : intentLineNear
                ? `주변 추천 · ${nextQuery.slice(0, 18)}${nextQuery.length > 18 ? "…" : ""} · ${intentLineNear}`
                : `주변 추천 · ${nextQuery.slice(0, 24)}${nextQuery.length > 24 ? "…" : ""}`
        );
        setAiReasons(["거리·검색어 점수", "카테고리 매칭", "의도 키워드 반영"]);
        const kakaoIdsNear = scoredPlaces.map((p) => p.id);
        let mergedNear = kakaoIdsNear;
        if (!useBasicSearchPipeline) {
          const dbSearchNear = await fetchCuratorPlaceDbSearch(AI_API_BASE, {
            query: nextQuery,
            limit: 24,
            mode: "auto",
            maxDistanceM: 12000,
            originLat: userLocation.lat,
            originLng: userLocation.lng,
          });
          mergedNear = dbSearchNear.ok
            ? mergeDbPlaceIdsFirst(dbSearchNear.rows, kakaoIdsNear)
            : kakaoIdsNear;
        }
        setAiRecommendedIds(mergedNear);
        setBlogReviews([]);
        shouldOpenAiSheetAfterLoad = scoredPlaces.length > 0;
        {
          const markersOnlySimpleSearch =
            isSimpleLocationMenuMapQuery(nextQuery) &&
            !isLikelyNaturalLanguageSearchQuery(nextQuery, naturalQ);
          if (markersOnlySimpleSearch) {
            shouldOpenAiSheetAfterLoad = false;
            setSimpleMapSearchMarkersOnly(true);
          }
        }
        if (useBasicSearchPipeline) {
          shouldOpenAiSheetAfterLoad = false;
          setSimpleMapSearchMarkersOnly(true);
        }

        // 지도에 바로 마커 표시
        const kakaoFormattedPlaces = scoredPlaces.map((place) => ({
          ...place,
          lat: parseFloat(place.y ?? place.lat),
          lng: parseFloat(place.x ?? place.lng),
          name: place.place_name || place.name,
          place_name: place.place_name || place.name,
          address_name: place.address_name || place.road_address_name,
          category_name: place.category_name,
          phone: place.phone || "",
          id: place.id,
          isExternal: true,
          isLive: true,
          kakao_place_id: place.kakao_place_id,
          isKakaoPlace: true,
        }));
        
        setKakaoPlaces(kakaoFormattedPlaces);
        openPreviewForFirstSearchResult(
          kakaoFormattedPlaces,
          "search_bar_submit_nearby"
        );
        searchResultIdsForLog = mergedNear.map((id) => String(id));

      } else {
        // 전체 지도 범용 검색 (바로 검색) - 미리보기 리스트 후 마커
        console.log("🔍 전체 지도 범용 검색 시작:", nextQuery);

        const kwForMap = stripPartyAndChatterForKeywordSearch(nextQuery) || nextQuery;
        let locationName = extractLocationAnchorFromQuery(kwForMap);

        /** OO구·OO동 등 행정 단위는 «강남» 별칭으로 줄이지 않음 — geo-only·경계 표시가 깨지지 않게 */
        if (!shouldKeepExtractedLocationForMapSearch(locationName)) {
          if (kwForMap.includes("동대문")) locationName = "동대문";
          else if (kwForMap.includes("성수")) locationName = "성수";
          else if (kwForMap.includes("강남")) locationName = "강남";
          else if (kwForMap.includes("삼성")) locationName = "삼성";
          else if (kwForMap.includes("서울")) locationName = "서울";
        }

        if (!locationName) {
          const areaHit = findAreaKeywordInQuery(kwForMap);
          if (areaHit) locationName = areaHit;
        }
        
        const normalizedMapKw = kwForMap.replace(/\s+/g, "");
        const isPojangmachaMap =
          normalizedMapKw.includes("포장마차") || normalizedMapKw.includes("포차");
        const foodKeywordsMap = [
          "해장국", "해장", "국밥", "순대국", "감자탕", "곰탕", "설렁탕", "칼국수", "라면", "냉면",
          "짜장면", "짬뽕", "우동", "쌀국수", "돈까스", "초밥",
          "해산물", "횟집", "해물", "생선회", "회집", "조개", "새우",
          "삼겹살", "갈비", "치킨",
          "족발", "보쌈", "한식", "중식", "일식", "양식", "분식", "식당", "맛집", "카페", "커피",
          "브런치", "빵", "케이크", "디저트", "피자", "파스타", "스테이크", "햄버거", "샐러드",
          "죽", "백반", "도시락", "김밥", "떡볶이", "순대", "만두", "전골", "찌개", "탕", "국수",
        ];
        const matchedFoodKeywordMap =
          foodKeywordsMap.find((k) => kwForMap.includes(k)) || null;
        const barKeywordsMap = [
          "야장술집",
          "야장",
          "포장마차",
          "술집",
          "포차",
          "펍",
          "주점",
          "호프",
          "이자카야",
          "와인바",
          "칵테일바",
          "맥주",
          "소주",
          "하이볼",
          "위스키",
          "칵테일",
        ];
        const matchedBarKeywordMap =
          barKeywordsMap.find((k) => kwForMap.includes(k)) || null;
        const vagueNightOutMap =
          !matchedFoodKeywordMap &&
          !matchedBarKeywordMap &&
          /(?:술|맥주|소주|하이볼|2차|이차|뒷풀이|회식|회식\s*후|술집|포차)/.test(
            normalizedMapKw
          );
        const hoesikSearchKeywordMap = /회식|단체|워크샵|팀\s*저녁|부서/.test(
          normalizedMapKw
        );
        const barKeywordMap = isPojangmachaMap
          ? "포장마차"
          : matchedBarKeywordMap ||
            (vagueNightOutMap
              ? hoesikSearchKeywordMap
                ? "회식"
                : "술집"
              : null);

        let intentPhraseMap = null;
        if (isPojangmachaMap && matchedFoodKeywordMap) {
          intentPhraseMap = `${matchedFoodKeywordMap} 포장마차`;
        } else if (isPojangmachaMap) {
          intentPhraseMap = "포장마차";
        } else {
          intentPhraseMap = matchedFoodKeywordMap || barKeywordMap || null;
        }

        const tailAfterLocationMap = locationName
          ? kwForMap
              .replace(
                new RegExp(locationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
                ""
              )
              .trim()
          : kwForMap.trim();

        const geoOnlyMapPan = isMapGeographicPanOnlyQuery({
          locationName,
          intentPhraseMap,
          tailAfterLocationMap,
        });

        if (geoOnlyMapPan) {
          const outlineQuery = String(locationName || "").trim();
          const outlineSessionId = searchSessionIdRef.current;
          if (mapRef.current && window.kakao?.maps?.services) {
            try {
              const psGeo = new window.kakao.maps.services.Places();
              await new Promise((resolve) => {
                psGeo.keywordSearch(locationName, (data, status) => {
                  if (
                    status === window.kakao.maps.services.Status.OK &&
                    Array.isArray(data) &&
                    data.length > 0
                  ) {
                    const fr = data[0];
                    mapRef.current.moveToLocation(fr.y, fr.x);
                    mapRef.current.setZoomLevel?.(5);
                  }
                  resolve();
                });
              });
              await new Promise((r) => setTimeout(r, 280));
            } catch (geoErr) {
              if (import.meta.env.DEV) console.warn("지역명 줌인:", geoErr);
            }
          }
          if (outlineQuery) {
            void (async () => {
              try {
                const pack = await fetchRegionOutline(outlineQuery, AI_API_BASE);
                if (searchSessionIdRef.current !== outlineSessionId) return;
                if (pack?.ok && Array.isArray(pack.rings) && pack.rings.length > 0) {
                  setRegionBoundaryOverlay({
                    key: `${outlineQuery}-${outlineSessionId}`,
                    rings: pack.rings,
                    fitBounds: true,
                  });
                } else {
                  setRegionBoundaryOverlay(null);
                }
              } catch (outlineErr) {
                if (import.meta.env.DEV) {
                  console.warn("행정구역 경계:", outlineErr);
                }
                if (searchSessionIdRef.current !== outlineSessionId) return;
                setRegionBoundaryOverlay(null);
              }
            })();
          }
          searchHereArmedRef.current = false;
          setShowMapSearchHereButton(true);
          setMapViewportSearchLock(false);
          setExternalPlaces([]);
          setAiRecommendedIds([]);
          setAiSummary("");
          setAiReasons([]);
          setBlogReviews([]);
          setKakaoPlaces([]);
          setSelectedPlace(null);
          searchModeForLog = "map_geo_only";
          shouldOpenAiSheetAfterLoad = false;
          searchResultIdsForLog = [];
          skipMinSearchLoading = true;
          return;
        }

        const intentAssist = await intentAssistPromise;
        const mapOriginPromise = getCurrentUserLocation();
        const searchHereArmedAtMapStart = searchHereArmedRef.current;

        let searchKeyword;
        if (locationName) {
          searchKeyword = intentPhraseMap
            ? `${locationName} ${intentPhraseMap}`
            : tailAfterLocationMap
              ? `${locationName} ${tailAfterLocationMap}`
              : locationName;
        } else if (intentPhraseMap) {
          searchKeyword = intentPhraseMap;
        } else {
          const businessPattern = /(\w+집|\w+당|\w+관|\w+점|\w+식|\w+당|\w+국|\w+면|\w+밥|\w+찌개|\w+탕|\w+전골|\w+카페|\w+빵|\w+케이크|\w+피자|\w+햄버거|\w+치킨|\w+파스타|\w+스테이크|\w+초밥|\w+돈까스|\w+라면|\w+김밥|\w+떡볶이|\w+순대|\w호떡|\w붕어빵|\w+타코|\w+샐러드|\w+스프|\w+커리|\w+짜장|\w+짬뽕|\w+볶음밥|\w+fried rice|\w+noodle|\w+soup|\w+cafe|\w+restaurant|\w+food|해장국|해장|순대국|부대찌개|김치찌개|된장찌개|갈비탕|삼계탕|뼈해장국|순두부|고등어|조개|꽁치|장어|생선회|물회|초밥|돈까스|우동|라멘|국수|냉면|비빔국수|칼국수|잔치국수|만두|군만두|물만두|고기|불고기|갈비|삼겹살|목살|닭갈비|소갈비|돼지갈비|소고기|돼지고기|닭고기|생선|게|새우|게장|새우볶음|낙지|오징어|문어|전복|조개구이|고등어구이|갈치구이|꽁치구이|장어구이|닭구이|치킨|후라이드치킨|양념치킨|간장치킨|피자|파스타|스파게티|알리오올리오|봉골레|까보나라|로제|토마토|크림|뇨끼|볶음밥|김치볶음밥|새우볶음밥|제육볶음|오징어볶음|낙지볶음|해물볶음|야채볶음|비빔밥|돌솥비빔밥|산채비빔밥|냉면|물냉면|비빔냉면|막국수|쫄면|칼국수|잔치국수|만두|군만두|물만두|고기|불고기|갈비|삼겹살|목살|닭갈비|소갈비|돼지갈비|소고기|돼지고기|닭고기|생선|게|새우|게장|새우볶음|낙지|오징어|문어|전복|조개구이|고등어구이|갈치구이|꽁치구이|장어구이|닭구이|치킨|후라이드치킨|양념치킨|간장치킨)/;
          const businessMatch = kwForMap.match(businessPattern);
          const businessKeyword = businessMatch
            ? businessMatch[1]
            : kwForMap.includes("해장")
              ? "해장국"
              : kwForMap.includes("술") ||
                  kwForMap.includes("바") ||
                  kwForMap.includes("포차")
                ? "술집"
                : "음식점";
          searchKeyword = businessKeyword || nextQuery;
        }

        const mapPlaceSuffix = getKakaoKeywordSuffix(nextQuery);
        const searchKeywordApi = mapPlaceSuffix
          ? `${searchKeyword} ${mapPlaceSuffix}`.trim()
          : searchKeyword;

        const facetsForFilter = naturalQ.facets || parseSearchQuery(nextQuery);
        const clientMapQuery = mapPlaceSuffix
          ? `${searchKeyword} ${mapPlaceSuffix}`.trim()
          : searchKeyword;

        console.log("🔍 추출된 지역명:", locationName);
        console.log("🔍 최종 검색 키워드:", searchKeywordApi);
        // 2. 지역명으로 지도 이동 및 줌인 (「여기서 검색」모드면 이미 맞춘 화면 유지)
        if (locationName && mapRef.current && !searchHereArmedAtMapStart) {
          try {
            // 카카오 장소 검색으로 지역명 좌표 찾기
            const ps = new window.kakao.maps.services.Places();
            
            await new Promise((resolve) => {
              ps.keywordSearch(searchKeywordApi, (data, status) => {
                if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
                  const firstResult = data[0];
                  // 지도 이동 및 줌인
                  mapRef.current.moveToLocation(firstResult.y, firstResult.x);
                  mapRef.current.setZoomLevel(5); // 지역명 검색 시 더 좁은 범위
                  
                  console.log(`🗺️ ${searchKeywordApi}으로 지도 이동 및 줌인 완료`);
                }
                resolve(); // 항상 resolve 호출
              });
            });
            
            // 지도 이동 후 약간의 딜레이
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error('지역명 검색 실패:', error);
          }
        }

        // 3. 카카오 키워드 검색 (줌인된 지도 영역 기반)
        const kakaoHint =
          intentAssist?.kakaoKeywordHint &&
          String(intentAssist.kakaoKeywordHint).trim();
        let mapQuery = lockKeywordToClientForKakaoHint(nextQuery, facetsForFilter)
          ? clientMapQuery
          : kakaoHint
            ? mapPlaceSuffix
              ? `${kakaoHint} ${mapPlaceSuffix}`.trim()
              : kakaoHint
            : searchKeywordApi;

        const kwUnified =
          stripPartyAndChatterForKeywordSearch(mapQuery) || mapQuery;
        const phrasesForUnified = mergeIntentAssistIntoSearchPhrases(
          kwUnified,
          intentAssist
        );
        const mapBoundsLive = mapRef.current?.getBounds?.();
        const geoAnchoredUnified =
          !searchHereArmedAtMapStart &&
          kakaoQueryHasGeographicAnchor(kwUnified);

        const filterPlacesByMapViewport = (places) => {
          if (
            !mapBoundsLive ||
            !window.kakao?.maps ||
            geoAnchoredUnified ||
            !Array.isArray(places)
          ) {
            return places;
          }
          return places.filter((place) => {
            const lat = parseFloat(place.y);
            const lng = parseFloat(place.x);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
            return mapBoundsLive.contain(
              new window.kakao.maps.LatLng(lat, lng)
            );
          });
        };

        let mapPlaces = [];
        let unifiedBlogFromServer = [];
        let unifiedApiRespondedOk = false;
        if (!useBasicSearchPipeline) {
          try {
            const unified = await fetchUnifiedMapSearch(
              {
                query: nextQuery,
                searchPhrases:
                  phrasesForUnified.length > 0 ? phrasesForUnified : [kwUnified],
                includeBlog: true,
                blogTimeoutMs: 14000,
              },
              AI_API_BASE
            );
            if (unified?.ok === true && Array.isArray(unified.places)) {
              unifiedApiRespondedOk = true;
              mapPlaces = unified.places.map((p) => ({ ...p, distance: 0 }));
              unifiedBlogFromServer = Array.isArray(unified.blogReviews)
                ? unified.blogReviews
                : [];
              console.log("🗺️ 통합 검색(네이버+카카오+블로그):", {
                places: mapPlaces.length,
                blog: unifiedBlogFromServer.length,
                meta: unified.meta,
              });
            }
          } catch (unifiedErr) {
            console.warn(
              "🗺️ 통합 검색 실패, 카카오 지도 SDK만 사용:",
              unifiedErr?.message
            );
          }
        }

        if (mapPlaces.length === 0) {
          mapPlaces = await searchMapBars(mapQuery);
          if (
            mapPlaces.length === 0 &&
            kakaoHint &&
            kakaoHint !== nextQuery.trim()
          ) {
            mapPlaces = await searchMapBars(searchKeywordApi);
          }
        }

        mapPlaces = filterPlacesByMapViewport(mapPlaces);
        mapPlaces = filterPlacesByParsedIntent(
          mapPlaces,
          facetsForFilter,
          nextQuery,
          { curatorCatalogForYajang: curatorPlaceCatalogForMerge }
        );
        console.log("🗺️ 전체 지도 검색 결과:", mapPlaces.length, {
          mapQuery,
          intentAssist: !!intentAssist,
        });

        const mapOriginForSort = await mapOriginPromise;
        const mapCenterFromRef = mapRef.current?.getCenter?.();
        const sortOrigin =
          mapCenterFromRef &&
          Number.isFinite(mapCenterFromRef.lat) &&
          Number.isFinite(mapCenterFromRef.lng)
            ? { lat: mapCenterFromRef.lat, lng: mapCenterFromRef.lng }
            : mapOriginForSort;

        // 4. AI 스코어링 + 결과 없으면 확장 쿼리 자동 재시도 (추천 순서: 가까운 거리순)
        let scoredPlaces = calculateLocalAIScores(
          mapPlaces,
          nextQuery,
          null,
          sortOrigin
        );
        let relaxationUsedMap = null;
        if (scoredPlaces.length === 0) {
          const parsedEmpty = naturalQ.facets;
          const expandPack = buildExpansionSuggestions(
            nextQuery,
            parsedEmpty,
            intentAssist
          );
          for (const rq of expandPack.autoRetryQueries) {
            const r = String(rq || "").trim();
            if (!r) continue;
            let mp = [];
            if (!useBasicSearchPipeline) {
              try {
                const u2 = await fetchUnifiedMapSearch(
                  {
                    query: nextQuery,
                    searchPhrases: [r],
                    includeBlog: false,
                    blogTimeoutMs: 4000,
                  },
                  AI_API_BASE
                );
                if (u2?.ok && Array.isArray(u2.places) && u2.places.length > 0) {
                  mp = u2.places.map((p) => ({ ...p, distance: 0 }));
                }
              } catch {
                /* fall through */
              }
            }
            if (mp.length === 0) {
              mp = await searchMapBars(r);
            }
            const mpViewport = filterPlacesByMapViewport(mp);
            const mpFiltered = filterPlacesByParsedIntent(
              mpViewport,
              facetsForFilter,
              nextQuery,
              { curatorCatalogForYajang: curatorPlaceCatalogForMerge }
            );
            const sp = calculateLocalAIScores(
              mpFiltered,
              nextQuery,
              null,
              sortOrigin
            );
            if (sp.length > 0) {
              scoredPlaces = sp;
              relaxationUsedMap = r;
              break;
            }
          }
          if (scoredPlaces.length === 0) {
            setSearchExpandUX({
              headline: expandPack.headline,
              subline: expandPack.subline,
              dataNote: expandPack.dataNote,
              fallbackHints: expandPack.fallbackHints,
              suggestions: expandPack.suggestions,
              quickBroadenQuery: expandPack.quickBroadenQuery,
              quickBroadenLabel: expandPack.quickBroadenLabel,
              originalQuery: nextQuery,
            });
          } else {
            setSearchExpandUX(null);
            showToast(
              `범위를 넓혀 «${relaxationUsedMap}»(으)로 찾았어요`,
              "info",
              4200
            );
          }
        } else {
          setSearchExpandUX(null);
        }

        let yajangBannerPayloadMap = null;
        if (scoredPlaces.length === 0) {
          const fbMap = applyYajangCuratorFallbackIfEmpty(
            sortOrigin,
            curatorPlaceCatalogForMerge,
            nextQuery,
            scoredPlaces
          );
          if (fbMap.usedFallback) {
            scoredPlaces = fbMap.scoredPlaces;
            setSearchExpandUX(null);
            yajangBannerPayloadMap = fbMap.banner;
            setYajangFallbackBanner(fbMap.banner);
          }
        } else {
          setYajangFallbackBanner(null);
        }

        console.log('🎯 AI 최종 추천:', scoredPlaces.length, relaxationUsedMap || "");

        setSearchDistanceOrigin({
          lat: sortOrigin.lat,
          lng: sortOrigin.lng,
        });

        // 결과 설정 (미리보기 리스트 + 실시간 마커)
        setExternalPlaces(
          scoredPlaces.map((p) => ({ ...p, isKakaoPlace: true }))
        );
        const intentLineMap = (() => {
          const s = intentAssist?.intentSummary && String(intentAssist.intentSummary).trim();
          if (!s) return "";
          return s.length > 36 ? `${s.slice(0, 36)}…` : s;
        })();
        setAiSummary(
          yajangBannerPayloadMap
            ? `5km 안 큐레이터 야장 ${scoredPlaces.length}곳 · ${searchKeywordApi}`
            : intentLineMap
              ? `${searchKeywordApi} 검색 · ${intentLineMap}`
              : `${searchKeywordApi} 검색 결과`
        );
        setAiReasons([`${searchKeywordApi} 지역 검색`, `지도 이동 및 줌인`]);
        const kakaoIdsMap = scoredPlaces.map((p) => p.id);
        let mergedMap = kakaoIdsMap;
        if (!useBasicSearchPipeline) {
          const dbSearchMap = await fetchCuratorPlaceDbSearch(AI_API_BASE, {
            query: nextQuery,
            limit: 24,
            mode: "auto",
            maxDistanceM: null,
            originLat: sortOrigin?.lat,
            originLng: sortOrigin?.lng,
          });
          mergedMap = dbSearchMap.ok
            ? mergeDbPlaceIdsFirst(dbSearchMap.rows, kakaoIdsMap)
            : kakaoIdsMap;
        }
        setAiRecommendedIds(mergedMap);
        shouldOpenAiSheetAfterLoad = scoredPlaces.length > 0;
        {
          const markersOnlySimpleSearch =
            isSimpleLocationMenuMapQuery(nextQuery) &&
            !isLikelyNaturalLanguageSearchQuery(nextQuery, naturalQ);
          if (markersOnlySimpleSearch) {
            shouldOpenAiSheetAfterLoad = false;
            setSimpleMapSearchMarkersOnly(true);
          }
        }
        if (useBasicSearchPipeline) {
          shouldOpenAiSheetAfterLoad = false;
          setSimpleMapSearchMarkersOnly(true);
        }

        // 지도에도 실시간 마커 표시 + 지도 이동 (블로그 크롤 전에 먼저 반영 — 로딩 무한 방지)
        const kakaoFormattedPlaces = scoredPlaces.map((place) => ({
          ...place,
          lat: parseFloat(place.y ?? place.lat),
          lng: parseFloat(place.x ?? place.lng),
          name: place.place_name || place.name,
          place_name: place.place_name || place.name,
          address_name: place.address_name || place.road_address_name,
          category_name: place.category_name,
          phone: place.phone || "",
          id: place.id,
          isExternal: true,
          isLive: true,
          isKakaoPlace: true,
          kakao_place_id:
            place.kakao_place_id ??
            (place.source === "kakao" ? place.id : null),
          source: place.source || (place.isYajangCuratorFallback ? "curator_yajang_fallback" : "kakao"),
        }));

        setKakaoPlaces(kakaoFormattedPlaces);
        openPreviewForFirstSearchResult(
          kakaoFormattedPlaces,
          "search_bar_submit_map"
        );
        searchResultIdsForLog = mergedMap.map((id) => String(id));

        if (searchHereArmedAtMapStart) {
          searchHereArmedRef.current = false;
          setMapViewportSearchLock(false);
        }

        // 검색 결과는 현재 뷰 유지 — 마커만 갱신(MapView preserveViewport와 동일 정책)
        if (kakaoFormattedPlaces.length > 0 && mapRef.current) {
          const c = mapRef.current.getCenter?.();
          if (
            c &&
            Number.isFinite(c.lat) &&
            Number.isFinite(c.lng)
          ) {
            setMapViewportCenterFromUser({ lat: c.lat, lng: c.lng });
          }
        } else if (kakaoFormattedPlaces.length === 0) {
          console.log("⚠️ 검색 결과가 없거나 맵 레퍼런스가 없습니다:", {
            hasPlaces: kakaoFormattedPlaces.length > 0,
            hasMapRef: !!mapRef.current,
            kakaoApi: !!window.kakao?.maps,
          });
        }

        if (unifiedBlogFromServer.length > 0) {
          setBlogReviews(unifiedBlogFromServer);
        } else if (!unifiedApiRespondedOk) {
          void searchBlogReviews(nextQuery)
            .then((reviews) =>
              setBlogReviews(Array.isArray(reviews) ? reviews : [])
            )
            .catch(() => setBlogReviews([]));
        } else {
          setBlogReviews([]);
        }
      }

    } catch (error) {
      shouldOpenAiSheetAfterLoad = false;
      searchHadError = true;
      console.error("AI 검색 오류:", error);
      alert(error?.message || "검색 처리에 실패했습니다.");
    } finally {
      insertSearchLog({
        sessionId: searchSessionId,
        userQuery: nextQuery,
        parsed: naturalQ.facets || parseSearchQuery(nextQuery),
        searchResultsIds: searchResultIdsForLog,
        hasResults: searchResultIdsForLog.length > 0,
        user,
        searchMode: searchModeForLog,
        hadClientError: searchHadError,
      });
      const elapsed = Date.now() - searchUiStartedAt;
      if (elapsed < MIN_SEARCH_LOADING_MS && !skipMinSearchLoading) {
        await new Promise((r) =>
          setTimeout(r, MIN_SEARCH_LOADING_MS - elapsed)
        );
      }
      setIsAiSearching(false);
      setSearchLoadingLabel("");
      if (shouldOpenAiSheetAfterLoad) {
        setAiSheetOpen(true);
      }
    }
  };

  // 팔로우 모달 핸들러
  const handleFollow = async (curatorName) => {
    // 로그인 체크
    if (!user) {
      showToast("로그인이 필요합니다. 로그인 후 팔로우할 수 있습니다.", "error", 3000);
      return;
    }
    
    // 자기 자신은 팔로우할 수 없음 (큐레이터인 경우만)
    const myUsername = curatorProfile?.username;
    if (myUsername && curatorName === myUsername) {
      showToast("자기 자신은 팔로우할 수 없습니다.", "error", 3000);
      return;
    }
    
    try {
      // 큐레이터 정보 조회 (UUID ID를 얻기 위해)
      const { data: curatorData, error: curatorError } = await supabase
        .from('curators')
        .select('id, username')
        .eq('username', curatorName)
        .single();
      
      if (curatorError || !curatorData) {
        console.error('큐레이터 정보 조회 실패:', curatorError);
        showToast('큐레이터 정보를 찾을 수 없습니다.', 'error', 3000);
        return;
      }
      
      // 팔로우 추가 (UUID ID로 저장)
      const { error: followError } = await supabase
        .from('user_follows')
        .insert({
          user_id: user.id,
          curator_id: curatorData.id, // UUID ID 저장
          created_at: new Date().toISOString()
        });
      
      if (followError) {
        console.error('팔로우 실패:', followError);
        
        // 23505 에러 (중복 팔로우) 처리
        if (followError.code === '23505' || followError.message?.includes('duplicate')) {
          showToast('이미 팔로우한 큐레이터입니다.', 'info', 3000);
        } else {
          showToast('팔로우에 실패했습니다.', 'error', 3000);
        }
        return;
      }

      void syncAuthProviderToProfile(supabase, user).catch(() => {});
      
      showToast(`@${curatorName} 큐레이터를 팔로우했습니다!`, 'success', 3000);
      setShowFollowModal(false);
      
    } catch (error) {
      console.error('팔로우 처리 오류:', error);
      showToast('팔로우에 실패했습니다.', 'error', 3000);
    }
  };

  // 큐레이터 상세 정보 가져오기
  const fetchCuratorDetails = async (curatorName) => {
    try {
      console.log("🔍 큐레이터 상세 정보 조회:", curatorName);
      
      // curators 테이블에서 상세 정보 조회
      const { data: curatorData, error: curatorError } = await supabase
        .from('curators')
        .select('*')
        .eq('username', curatorName)
        .maybeSingle(); // .single() 대신 .maybeSingle() 사용
      
      if (curatorError) {
        console.log("❌ 큐레이터 정보 조회 실패:", curatorError);
        return null;
      }
      
      if (!curatorData) {
        console.log("❌ 큐레이터 정보 없음:", curatorName);
        return null;
      }
      
      console.log("✅ 큐레이터 상세 정보:", curatorData);
      
      const curatorAuthId = curatorData.user_id;
      const { data: placesData, error: placesError } = await supabase
        .from('curator_places')
        .select('id')
        .eq('curator_id', curatorAuthId)
        .eq('is_archived', false);
      
      const placeCount = placesError ? 0 : (placesData?.length || 0);
      
      // 팔로워 수: user_follows 스키마(보통 curator_id → curators.id PK). curator_places 와 다름.
      const { data: followersData, error: followersError } = await supabase
        .from('user_follows')
        .select('id')
        .eq('curator_id', curatorData.id);
      
      const followerCount = followersError ? 0 : (followersData?.length || 0);
      
      return {
        ...curatorData,
        placeCount,
        followerCount,
        saveCount: 0 // 저장 수는 다른 테이블에서 조회 필요
      };
      
    } catch (error) {
      console.error("❌ 큐레이터 상세 정보 로드 실패:", error);
      return null;
    }
  };

  // 선택된 큐레이터 정보 업데이트
  useEffect(() => {
    if (selectedCurator && !selectedCurator.placeCount) {
      // 상세 정보가 없으면 가져오기
      const loadDetails = async () => {
        try {
          const details = await fetchCuratorDetails(selectedCurator.name);
          if (details) {
            setSelectedCurator(prev => ({
              ...prev,
              ...details
            }));
          }
        } catch (error) {
          console.error("❌ 큐레이터 상세 정보 로드 실패:", error);
        }
      };
      
      loadDetails();
    }
  }, [selectedCurator]);

  // 팔로우 모달에 표시할 큐레이터 정보
  const getModalCurator = () => {
    if (selectedCurator) {
      // 선택된 큐레이터 정보 사용 (실제 데이터)
      return {
        username: selectedCurator.username || selectedCurator.name,
        displayName: selectedCurator.displayName || selectedCurator.name,
        level: selectedCurator.grade || 2, // 실제 등급 또는 기본값
        saveCount: selectedCurator.saveCount || 0, // 실제 저장 수
        placeCount: selectedCurator.placeCount || 0, // 실제 장소 수
        followerCount: selectedCurator.followerCount || 0, // 실제 팔로워 수
        bio: selectedCurator.bio || "소개가 없습니다.",
        avatar: selectedCurator.avatar
      };
    }
    
    // 일반 사용자인 경우: 첫번째 큐레이터 표시
    if (!curatorProfile && dbCurators.length > 0) {
      const firstCurator = dbCurators[0];
      return {
        username: firstCurator.name,
        displayName: firstCurator.displayName || firstCurator.name,
        level: 2, // Local Curator
        saveCount: 60,
        placeCount: 9,
        followerCount: 123,
        bio: "서울의 숨은 명소를 찾아다니는 큐레이터입니다. 주로 혼술하기 좋은 조용한 곳을 추천해요."
      };
    }
    
    // 큐레이터인 경우: 자기 자신 표시 (팔로우 불가)
    return {
      username: curatorProfile?.username || "nopokiller",
      displayName: curatorProfile?.displayName || "노포킬러",
      level: 2, // Local Curator
      saveCount: 60,
      placeCount: 9,
      followerCount: 123,
      bio: curatorProfile?.bio || "서울의 숨은 명소를 찾아다니는 큐레이터입니다. 주로 혼술하기 좋은 조용한 곳을 추천해요."
    };
  };

  const testCurator = getModalCurator();

  // 내 위치 버튼 클릭 핸들러 (로그인 체크)
  const handleCurrentLocationClick = () => {
    if (!user) {
      // 비로그인 사용자는 로그인 유도 모달 표시
      requireLogin('location');
      return true; // true 반환하면 MapView의 기본 동작 중단
    }
    // 로그인 사용자는 false 반환하여 MapView의 기본 동작 계속 진행
    return false;
  };

  return (
    <>
      {/* 실시간 Toast 알림 */}
      <AnimatedToast position="top-right" />
      
      {/* 실시간 체크인 랭킹 */}
      <CheckinRanking position="sidebar" />

      {/* 로그인 유도 모달 */}
      {showLoginPrompt && (
        <FeatureLoginPrompt
          feature={requiredFeature}
          onClose={closeLoginPrompt}
          onLogin={() => {
            closeLoginPrompt();
            // 로그인 페이지로 이동 또는 소셜 로그인 호출
            signInWithProvider('google');
          }}
        />
      )}
      
      {/* 팔로우 모달 */}
      {showFollowModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowFollowModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "25px",
              width: "min(380px, calc(100vw - 32px))",
              maxWidth: "100%",
              boxSizing: "border-box",
              textAlign: "center",
              overflowWrap: "break-word",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 큐레이터 프로필 정보 */}
            <div style={{ marginBottom: "20px" }}>
              {/* 프로필 이미지와 이름 */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", minWidth: 0 }}>
                {testCurator.avatar ? (
                  <img
                    src={testCurator.avatar}
                    alt={testCurator.displayName}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #2ECC71"
                    }}
                  />
                ) : (
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: "#2ECC71",
                    color: "white",
                    fontSize: "18px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #2ECC71"
                  }}>
                    {testCurator.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "#333", fontWeight: "bold", overflowWrap: "break-word", wordBreak: "break-word" }}>
                    @{testCurator.username}
                  </h3>
                  <div style={{ 
                    fontSize: "14px", 
                    color: "666",
                    fontWeight: "500"
                  }}>
                    {testCurator.level >= 4 ? "👑 Top Curator" : 
                     testCurator.level >= 3 ? "🏆 Trusted Curator" : 
                     testCurator.level >= 2 ? "⭐ Local Curator" : "🌱 New Drinker"}
                  </div>
                </div>
              </div>
              
              {/* 자기 소개글 */}
              <div style={{ 
                fontSize: "14px", 
                color: "#555",
                lineHeight: "1.5",
                marginBottom: "16px",
                padding: "12px",
                backgroundColor: "#f8f9fa",
                borderRadius: "8px"
              }}>
                "{testCurator.bio}"
              </div>
              
              {/* 통계 정보 */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(3, 1fr)", 
                gap: "12px",
                marginBottom: "20px"
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#E74C3C" }}>
                    {testCurator.saveCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    저장수
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#F39C12" }}>
                    {testCurator.placeCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    추천 장소
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "#9B59B6" }}>
                    {testCurator.followerCount}
                  </div>
                  <div style={{ fontSize: "11px", color: "#999" }}>
                    팔로워
                  </div>
                </div>
              </div>
            </div>
            
            {/* 팔로우 버튼 */}
            <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
              {testCurator.username === curatorProfile?.username ? (
                <div
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    padding: "14px 12px",
                    backgroundColor: "#e9ecef",
                    color: "#6c757d",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: "bold",
                    textAlign: "center",
                    cursor: "not-allowed",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                    lineHeight: 1.35,
                  }}
                >
                  자기 자신은 팔로우할 수 없습니다
                </div>
              ) : (
                <button
                  type="button"
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    padding: "16px",
                    backgroundColor: "#2ECC71",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 12px rgba(46, 204, 113, 0.3)",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#27AE60";
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 6px 16px rgba(46, 204, 113, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#2ECC71";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 12px rgba(46, 204, 113, 0.3)";
                  }}
                  onClick={() => handleFollow(testCurator.username)}
                >
                  팔로우하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={styles.page}>
      <main style={styles.mainContainer}>
        {/* 실시간 체크인 토스트 - 지도 좌측 */}
        <div style={{ 
          position: 'absolute', 
          top: '62px', // 실시간 체크인 토스트 — 헤더에 더 붙이기
          left: '20px', // 좌측에 붙임
          transform: 'none', // 중앙 정렬 제거
          zIndex: 1000, // 헤더보다 낮게
          pointerEvents: 'none'
        }}>
          <CheckInToast />
        </div>

        <HotCheckinStrip
          rankingTop5={rankingTop5}
          risingCurators={risingCurators}
          placesOnMap={mapDisplayedPlacesWithLegend}
          mapRef={mapRef}
          hideWhenPreviewOpen={Boolean(selectedPlace)}
          onPickPlace={(place) =>
            setSelectedPlaceWithAnalytics(place, "hot_strip")
          }
          onPickCurator={handleRisingCuratorPick}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minHeight: 0,
          }}
        >
          {mapViewportDbLoading && (
            <div
              role="status"
              style={{
                position: "absolute",
                top: 52,
                left: 12,
                zIndex: 20,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.96)",
                borderRadius: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                fontSize: 13,
                pointerEvents: "none",
              }}
            >
              불러오는 중…
            </div>
          )}
          <MapView
            ref={mapRef}
            showFloatingLocationButton={false}
            onMyLocationLoadingChange={setMapLocationLoading}
            places={mapDisplayedPlacesWithLegend}
            selectedPlace={selectedPlace}
            setSelectedPlace={setSelectedPlaceWithAnalytics}
            closePlacePreviewOnMapClick={
              !(courseSecondPickMode && Boolean(selectedPlace))
            }
            curatorColorMap={curatorColorMap}
            savedColorMap={savedColorMap}
            livePlaceIds={livePlaceIds}
            userFolders={userSavedPlaces} // 사용자 폴더 정보 전달
            onQuickSave={handleQuickSave} // 쾌속 잔 채우기 핸들러 전달
            userRole={getUserRole?.()} // 사용자 역할 전달
            onSave={setSaveTargetPlace} // 일반 사용자 저장 핸들러 전달
            savedFolders={savedColorMap} // 저장된 폴더 정보 전달
            userSavedPlaces={userSavedPlaces} // 사용자 저장 장소 정보 전달
            onLocationButtonClick={handleCurrentLocationClick}
            onCurrentLocationChange={(location) => {
              setCurrentLocation(location);
              console.log('📍 현재 위치 업데이트:', location);
            }}
            onMapViewportChange={onMapViewportChange}
            checkinCountByPlaceId={placeCheckinCounts}
            hotRankTopPlaceIds={hotRankTopPlaceIds}
            onMapBackgroundClick={() =>
              setMarkerGuideMapCloseTick((t) => t + 1)
            }
            onMapBlankClick={handleMapBlankPick}
            preserveViewportOnPlacesChange={
              Boolean(String(query || "").trim()) ||
              showMapSearchHereButton ||
              mapViewportSearchLock
            }
            skipKoreaBBoxForCuratorPins={
              !isCourseMode &&
              Array.isArray(selectedCurators) &&
              selectedCurators.length > 0 &&
              !showSavedOnly
            }
            courseOverlay={courseMapOverlay}
            courseOverlayFitBottomPaddingPx={courseMapFitBottomPaddingPx}
            onCourseOverlayDismiss={dismissCourseMapPath}
            arrivalWalkingOverlay={arrivalWalkingOverlay}
            arrivalWalkingOverlayFitBottomPaddingPx={courseMapFitBottomPaddingPx}
            onArrivalWalkingOverlayDismiss={dismissArrivalWalkingOverlay}
            courseSecondPickMode={courseSecondPickMode}
            regionBoundaryOverlay={regionBoundaryOverlay}
            regionBoundaryFitBottomPaddingPx={courseMapFitBottomPaddingPx}
          />
          {showMapSearchHereButton ? (
            <button
              type="button"
              onClick={() => {
                searchHereArmedRef.current = true;
                setShowMapSearchHereButton(false);
                setMapViewportSearchLock(true);
                showToast(
                  "다음 검색은 지금 화면 안에서만 찾아요.",
                  "info",
                  2600
                );
              }}
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                bottom: "calc(108px + env(safe-area-inset-bottom, 0px))",
                zIndex: 130,
                padding: "11px 18px",
                borderRadius: 999,
                border: "1px solid rgba(124, 58, 237, 0.55)",
                background: "rgba(255,255,255,0.98)",
                color: "#5b21b6",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 18px rgba(0,0,0,0.14)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              여기서 검색
            </button>
          ) : null}
        </div>

        {courseSecondFindModalOpen ? (
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 240,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: "12px 12px max(16px, env(safe-area-inset-bottom))",
              pointerEvents: "auto",
            }}
            onClick={cancelCourseSecondFindModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-second-find-title"
              style={{
                width: "100%",
                maxWidth: 420,
                maxHeight: "min(72vh, 520px)",
                overflow: "auto",
                borderRadius: 16,
                background: "rgba(255,255,255,0.98)",
                boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
                padding: "16px 16px 14px",
                pointerEvents: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                id="course-second-find-title"
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#3d2914",
                  marginBottom: 4,
                }}
              >
                2차 후보 조건
              </div>
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "#666",
                }}
              >
                골라 주시면 그에 맞춰 가산점을 줘요. 분위기·주종은 잔 올리기와
                같은 목록이에요. 거리는 1차 기준으로 후보를 잘라요. 안 고르면
                분위기·주종·안주는 기본 룰만 쓰고, 거리는 3km로 둡니다.
              </p>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#5b21b6",
                  marginBottom: 6,
                }}
              >
                분위기
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                {STUDIO_ATMOSPHERE_OPTIONS.map((v) => {
                  const on = courseSecondFindVibes.includes(v);
                  return (
                    <button
                      key={`2fv-${v}`}
                      type="button"
                      onClick={() =>
                        setCourseSecondFindVibes((prev) =>
                          prev.includes(v)
                            ? prev.filter((x) => x !== v)
                            : [...prev, v]
                        )
                      }
                      style={{
                        padding: "6px 11px",
                        borderRadius: 999,
                        border: on
                          ? "1px solid rgba(124, 58, 237, 0.65)"
                          : "1px solid rgba(92, 64, 51, 0.18)",
                        background: on
                          ? "rgba(250,245,255,0.98)"
                          : "rgba(255,255,255,0.95)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: on ? "#5b21b6" : "#5c4033",
                        cursor: "pointer",
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#5b21b6",
                  marginBottom: 6,
                }}
              >
                주종
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                {STUDIO_LIQUOR_TYPE_OPTIONS.map((v) => {
                  const on = courseSecondFindLiquors.includes(v);
                  return (
                    <button
                      key={`2fl-${v}`}
                      type="button"
                      onClick={() =>
                        setCourseSecondFindLiquors((prev) =>
                          prev.includes(v)
                            ? prev.filter((x) => x !== v)
                            : [...prev, v]
                        )
                      }
                      style={{
                        padding: "6px 11px",
                        borderRadius: 999,
                        border: on
                          ? "1px solid rgba(124, 58, 237, 0.65)"
                          : "1px solid rgba(92, 64, 51, 0.18)",
                        background: on
                          ? "rgba(250,245,255,0.98)"
                          : "rgba(255,255,255,0.95)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: on ? "#5b21b6" : "#5c4033",
                        cursor: "pointer",
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#5b21b6",
                  marginBottom: 6,
                }}
              >
                안주
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                {COURSE_SECOND_SNACK_OPTIONS.map((v) => {
                  const on = courseSecondFindAnju.includes(v);
                  return (
                    <button
                      key={`2fa-${v}`}
                      type="button"
                      onClick={() =>
                        setCourseSecondFindAnju((prev) =>
                          prev.includes(v)
                            ? prev.filter((x) => x !== v)
                            : [...prev, v]
                        )
                      }
                      style={{
                        padding: "6px 11px",
                        borderRadius: 999,
                        border: on
                          ? "1px solid rgba(124, 58, 237, 0.65)"
                          : "1px solid rgba(92, 64, 51, 0.18)",
                        background: on
                          ? "rgba(250,245,255,0.98)"
                          : "rgba(255,255,255,0.95)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: on ? "#5b21b6" : "#5c4033",
                        cursor: "pointer",
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#5b21b6",
                  marginBottom: 6,
                }}
              >
                1차에서 거리
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                {COURSE_SECOND_FIND_DISTANCE_OPTIONS.map(({ m, label }) => {
                  const on = courseSecondFindMaxDistanceM === m;
                  return (
                    <button
                      key={`2fd-${m}`}
                      type="button"
                      onClick={() => setCourseSecondFindMaxDistanceM(m)}
                      style={{
                        padding: "6px 11px",
                        borderRadius: 999,
                        border: on
                          ? "1px solid rgba(124, 58, 237, 0.65)"
                          : "1px solid rgba(92, 64, 51, 0.18)",
                        background: on
                          ? "rgba(250,245,255,0.98)"
                          : "rgba(255,255,255,0.95)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: on ? "#5b21b6" : "#5c4033",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#3d2914",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={courseSecondFindPreferCloser}
                  onChange={(e) =>
                    setCourseSecondFindPreferCloser(e.target.checked)
                  }
                />
                더 가까운 곳 우선
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#3d2914",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={courseSecondFindPrioritizeCurators}
                  onChange={(e) =>
                    setCourseSecondFindPrioritizeCurators(e.target.checked)
                  }
                  style={{ marginTop: 2 }}
                />
                <span>
                  큐레이터 추천 우선
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#777",
                    }}
                  >
                    여러 큐레이터가 겹쳐 담은 곳·등록 수에 가산점
                  </span>
                </span>
              </label>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={cancelCourseSecondFindModal}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(92, 64, 51, 0.22)",
                    background: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#5c4033",
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={mapCourseFirstBusy}
                  onClick={confirmCourseSecondFindModal}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "rgba(124, 58, 237, 0.92)",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#fff",
                    cursor: mapCourseFirstBusy ? "default" : "pointer",
                    opacity: mapCourseFirstBusy ? 0.65 : 1,
                  }}
                >
                  {mapCourseFirstBusy ? "찾는 중…" : "후보 찾기"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={styles.headerOverlay}>
          <div style={styles.logoStack}>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              style={styles.logoHomeButton}
              title="홈(새로고침)"
              aria-label="홈으로 이동하여 새로고침"
            >
              JUDO
            </button>
          </div>

          <div style={styles.filterWrapper}>
            <CuratorFilterBar
              curators={dbCurators}
              selectedCurators={selectedCurators}
              allActive={showAll && selectedCurators.length === 0}
              onToggle={(name) => {
                const key = String(name ?? "").trim();
                if (!key) return;

                setShowSavedOnly(false);
                setLegendCategory(null);
                const cleanPrev = selectedCuratorsRef.current.filter(
                  (item) => item != null && String(item).trim() !== ""
                );
                const token = canonicalCuratorChipToken(key, dbCurators);
                const idx = cleanPrev.findIndex((c) => {
                  const prev = String(c ?? "").trim();
                  if (!prev) return false;
                  return (
                    canonicalCuratorChipToken(prev, dbCurators).toLowerCase() ===
                    token.toLowerCase()
                  );
                });
                const next =
                  idx >= 0
                    ? cleanPrev.filter((_, i) => i !== idx)
                    : [...cleanPrev, token];
                setSelectedCurators(next);
                setShowAll(next.length === 0);
              }}
              onSelectAll={() => {
                setShowSavedOnly(false);
                setLegendCategory(null);
                if (selectedCurators.length > 0) {
                  setSelectedCurators([]);
                  setShowAll(true);
                } else {
                  setShowAll((prev) => !prev);
                }
                handleClearSearch();
              }}
              onProfileClick={(curator) => {
                console.log("👤 큐레이터 프로필 클릭:", curator);
                // 선택된 큐레이터 정보 설정하고 모달 표시
                setSelectedCurator(curator);
                setShowFollowModal(true);
              }}
            />
          </div>
        </div>

        <div style={styles.legendOverlay}>
          {courseSecondPickMode &&
          Array.isArray(courseSecondPulseMapPlaces) &&
          courseSecondPulseMapPlaces.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clearCourseSecondPickPulse();
                setSelectedPlace(null);
              }}
              style={styles.legendSecondPickResetButton}
              title="2차 후보 깜빡임·후보 마커 끄기"
              aria-label="2차 후보 끄기"
            >
              후보 끄기
            </button>
          ) : null}
          <MarkerLegend
            mapCloseTick={markerGuideMapCloseTick}
            savedOnly={showSavedOnly}
            onToggleSavedOnly={() => {
              setShowSavedOnly((prev) => {
                const next = !prev;
                if (next && selectedPlace) {
                  const savedKeySet = buildMergedSavedPlaceKeySet(
                    savedMap,
                    userSavedPlaces
                  );
                  if (!placeMatchesSavedKeySet(selectedPlace, savedKeySet)) {
                    setSelectedPlace(null);
                  }
                }
                return next;
              });
            }}
            activeCategory={legendCategory}
            closeSignal={selectedPlace}
            onSelectCategory={(key) => {
              setLegendCategory((prev) => (prev === key ? null : key));
              if (selectedPlace) setSelectedPlace(null);
            }}
          />
          <button
            type="button"
            onClick={() => mapRef.current?.requestMyLocation?.()}
            disabled={mapLocationLoading}
            style={{
              ...styles.legendMyLocationButton,
              opacity: mapLocationLoading ? 0.72 : 1,
            }}
            title="내 위치"
            aria-label="내 위치로 이동"
          >
            {mapLocationLoading ? (
              <span style={styles.legendMyLocationSpinner} aria-hidden />
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            )}
          </button>
        </div>

        {!selectedPlace ? (
          <div style={styles.bottomBarContainer}>
            <div style={styles.searchWrapper}>
              <CuratorPicksStrip
                places={curatorSpotlightPlaces}
                visible={!query.trim() && !isAiSearching}
                onPick={(place) => {
                  setSelectedPlaceWithAnalytics(place, "curator_spotlight");
                  if (
                    mapRef?.current?.moveToLocation &&
                    place?.lat != null &&
                    place?.lng != null
                  ) {
                    mapRef.current.moveToLocation(place.lat, place.lng);
                  }
                }}
              />
              <SearchBar
                query={query}
                setQuery={setQuery}
                onSubmit={handleSearchSubmit}
                onClear={handleClearSearch}
                onExampleClick={handleSearchSubmit}
                placeholder={
                  homeSearchChannel === "basic"
                    ? "장소 검색 · 지역·역·상호 (예: 강남 맥주집, OO포차)"
                    : "AI 주도 검색 · 동대문 근처 고기 먹고 해산물 포차 갈까? 3명이야…"
                }
                showChannelTabs
                searchChannel={homeSearchChannel}
                onSearchChannelChange={setHomeSearchChannel}
                isLoading={isAiSearching}
                loadingStatusText={searchLoadingLabel}
                mapRef={mapRef}
                compactRightActions={compactSearchBarAuth}
                showKakaoSearch={true}
                onKakaoPlaceSelect={handleKakaoPlaceSelect}
                onKakaoTypingPreviewPlacesChange={setKakaoTypingPreviewPlaces}
                userLocation={currentLocation}
                onNearbySearch={(location) => {
                  console.log('📍 내 주변 검색:', location);
                  setIsLocationBasedSearch(true);
                  // 현재 위치 상태 업데이트 (마커 표시용)
                  setCurrentLocation(location);
                  // 지도를 현재 위치로 이동
                  if (mapRef?.current?.moveToLocation) {
                    console.log('🗺️ 지도 이동:', location.lat, location.lng);
                    mapRef.current.moveToLocation(location.lat, location.lng);
                  } else {
                    console.log('⚠️ mapRef 또는 moveToLocation 없음:', mapRef?.current);
                  }
                }}
                onNearbyPlacesFound={(places) => {
                  console.log('📍 내 주변 술집 마커로 표시:', places.length, '개');
                  // 카카오 장소 데이터를 마커 형식으로 변환
                  const formattedPlaces = places.map(place => ({
                    id: `kakao_${place.id}`,
                    name: place.place_name,
                    address: place.road_address_name || place.address_name,
                    lat: parseFloat(place.y),
                    lng: parseFloat(place.x),
                    category: place.category_name,
                    phone: place.phone,
                    kakao_place_id: place.id,
                    isKakaoPlace: true,
                    isLive: true,
                    place_url: place.place_url,
                    category_name: place.category_name,
                    road_address_name: place.road_address_name,
                    distance: place.distance // 거리 정보 추가
                  }));
                  
                  // kakaoPlaces 상태에 추가하여 지도에 마커 표시
                  setKakaoPlaces(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newPlaces = formattedPlaces.filter(p => !existingIds.has(p.id));
                    return [...prev, ...newPlaces];
                  });
                  
                  // 검색창 비우기
                  setQuery('');
                }}
                onRealTimeSearch={(value) => {
                  // AI 실시간 검색 기능 추가
                  if (value.trim()) {
                    console.log('🤖 AI 실시간 검색:', value);
                    // 여기에 AI 검색 로직 추가
                  }
                }}
                onLocationModeChange={(isLocationBased) => {
                  setIsLocationBasedSearch(isLocationBased);
                  console.log('🔍 위치기반 검색 모드:', isLocationBased);
                }}
                rightActions={
                  <div
                    style={{
                      ...styles.authRowInline,
                      ...(compactSearchBarAuth ? styles.authRowInlineNarrow : {}),
                    }}
                  >
                    {/* 모든 사용자 @아이디 버튼 */}
                    {!authLoading && user && (
                      <button
                        type="button"
                        title={getProfileButtonHint().title}
                        aria-label={getProfileButtonHint().aria}
                        style={{
                          ...(getUserRole() === "admin"
                            ? styles.adminInlineButton
                            : getUserRole() === "curator"
                              ? styles.curatorInlineButton
                              : styles.userInlineButton),
                          ...styles.searchBarProfileButton,
                          ...(compactSearchBarAuth
                            ? styles.searchBarProfileButtonNarrow
                            : {}),
                        }}
                        onClick={() => {
                          const userRole = getUserRole();
                          console.log(" @아이디 버튼 클릭:", { userRole, isAdmin, isCurator, username: getDisplayUsername() });
                          
                          if (userRole === "admin") {
                            // Admin은 큐레이터 신청내역 페이지로 이동
                            navigate("/admin");
                          } else if (userRole === "curator") {
                            // 큐레이터는 스튜디오 페이지로 이동
                            navigate("/studio");
                          } else {
                            // 일반 사용자는 UserCard 표시
                            setShowUserCard(true);
                          }
                        }}
                      >
                        {searchBarProfilePhotoUrl && !searchBarProfileImgFailed ? (
                          <img
                            src={searchBarProfilePhotoUrl}
                            alt=""
                            style={styles.searchBarProfileImg}
                            onError={() => setSearchBarProfileImgFailed(true)}
                          />
                        ) : (
                          <span style={styles.searchBarProfileInitial}>
                            {getSearchBarProfileInitial()}
                          </span>
                        )}
                      </button>
                    )}
                    
                    {/* 일반 유저에게만 큐레이터 신청 버튼 표시 */}
                    {!authLoading && user && getUserRole() === "user" && (
                      <CuratorApplicationButton compact={compactSearchBarAuth} />
                    )}
                    
                    {authLoading ? null : user ? (
                      <button
                        type="button"
                        style={{
                          ...styles.authInlineButton,
                          ...(compactSearchBarAuth
                            ? styles.authInlineButtonNarrow
                            : {}),
                        }}
                        title="로그아웃"
                        onClick={() => {
                          signOut().catch((error) => {
                            console.error("signOut error:", error);
                            alert(error?.message || "로그아웃에 실패했습니다.");
                          });
                        }}
                      >
                        {compactSearchBarAuth ? "나가기" : "로그아웃"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          style={{
                            ...styles.authIconButton,
                            ...styles.googleButton,
                          }}
                          onClick={() => {
                            signInWithProvider("google").catch((error) => {
                              console.error("google login error:", error);
                              alert(error?.message || "구글 로그인에 실패했습니다.");
                            });
                          }}
                          aria-label="Google 로그인"
                          title="Google 로그인"
                        >
                          <span style={styles.googleG}>G</span>
                        </button>
                        <button
                          type="button"
                          style={{
                            ...styles.authIconButton,
                            ...styles.kakaoButton,
                          }}
                          onClick={() => {
                            signInWithProvider("kakao").catch((error) => {
                              console.error("kakao login error:", error);
                              alert(error?.message || "카카오 로그인에 실패했습니다.");
                            });
                          }}
                          aria-label="Kakao 로그인"
                          title="Kakao 로그인"
                        >
                          <span style={styles.kakaoK}>K</span>
                        </button>
                      </>
                    )}
                  </div>
                }
              />
            </div>
          </div>
        ) : null}

        <div
          style={{
            ...styles.mapCardOverlay,
            ...(isCourseMode && String(query).trim() && !isAiSearching
              ? {
                  /** 검색바 위로 겹쳐도 됨 — 코스 UI를 화면 맨 아래에 붙여 지도 영역 최대화 */
                  zIndex: 170,
                }
              : aiSheetOpen ||
                  (aiRecommendedIds.length > 0 &&
                    String(query || "").trim() &&
                    !simpleMapSearchMarkersOnly)
                ? {
                    /** 핫스트립(85)·검색바 래퍼(160)보다 위 — 맞춤 바텀시트·피크가 가리지 않게 */
                    zIndex: 320,
                  }
                : {}),
            bottom: selectedPlace
              ? "18px"
              : isCourseMode && String(query).trim() && !isAiSearching
                ? "env(safe-area-inset-bottom, 0px)"
                : styles.mapCardOverlay.bottom,
          }}
        >
          {selectedPlace ? (
            <div style={styles.previewStack}>
              <PlacePreviewCard
                place={selectedPlace}
                isSaved={previewSavedState.isSaved}
                savedFolderColor={
                  previewSavedState.folderColor ??
                  savedColorMap[selectedPlace.id]
                }
                selectedCurators={selectedCurators}
                onSavedToSupabase={loadUserSavedPlaces}
                onClose={() => setSelectedPlace(null)}
                getUserRole={getUserRole}
                searchSessionIdRef={searchSessionIdRef}
                onCourseMapFindSecond={openCourseSecondFindModal}
                courseMapFindSecondEnabled={Boolean(
                  resolvePlaceWgs84(selectedPlace) && !isAiSearching
                )}
                courseMapFindSecondBusy={
                  mapCourseFirstBusy || isRegeneratingSecond
                }
                onConfirmCourseSecondHere={handleConfirmCourseSecondHere}
                userLocation={currentLocation}
                onShowArrivalWalkingOnMap={handleShowArrivalWalkingOnMap}
                arrivalWalkingRouteShown={Boolean(arrivalWalkingOverlay)}
              />
            </div>
          ) : searchExpandUX && query.trim() && !isAiSearching ? (
            <div style={styles.expandSearchWrap} role="region" aria-label="검색 확장 제안">
              <div style={styles.expandSearchCard}>
                <div style={styles.expandSearchTitle}>{searchExpandUX.headline}</div>
                <p style={styles.expandSearchNote}>{searchExpandUX.dataNote}</p>
                <p style={styles.expandSearchSub}>{searchExpandUX.subline}</p>
                {Array.isArray(searchExpandUX.fallbackHints) &&
                searchExpandUX.fallbackHints.length > 0 ? (
                  <ul style={styles.expandFallbackHints} aria-label="조건 완화 아이디어">
                    {searchExpandUX.fallbackHints.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {searchExpandUX.quickBroadenQuery ? (
                  <button
                    type="button"
                    style={styles.expandPrimaryBtn}
                    onClick={() => {
                      setSearchExpandUX(null);
                      handleSearchSubmit(searchExpandUX.quickBroadenQuery);
                    }}
                  >
                    {searchExpandUX.quickBroadenLabel ||
                      `한 번에 넓게 «${searchExpandUX.quickBroadenQuery}»로 찾기`}
                  </button>
                ) : null}
                <div style={styles.expandChipCol}>
                  {(searchExpandUX.suggestions || []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      style={styles.expandChip}
                      onClick={() => {
                        setSearchExpandUX(null);
                        handleSearchSubmit(s.query);
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  style={styles.expandDismiss}
                  onClick={() => setSearchExpandUX(null)}
                >
                  닫기
                </button>
              </div>
            </div>
          ) : isCourseMode && query.trim() && !isAiSearching ? (
            <div style={styles.courseMergedShell}>
              <div ref={courseMergedHeaderRef} style={styles.courseMergedHeader}>
                <button
                  type="button"
                  style={styles.courseSearchClearButton}
                  onClick={handleClearSearch}
                  aria-label="코스 추천 취소 및 검색어 지우기"
                  title="검색어 지우고 새로 검색"
                >
                  ×
                </button>
                {courseHasFinalTwoSteps ? (
                  <button
                    type="button"
                    style={styles.courseResetPickButton}
                    onClick={() => void handleResetCoursePickWithSavePrompt()}
                    aria-label="선택한 코스만 비우기"
                    title="1차·2차 코스만 초기화 (검색어는 유지)"
                  >
                    ×
                  </button>
                ) : null}
                <button
                  type="button"
                  style={{
                    ...styles.aiPeekBar,
                    ...styles.courseAiPeekBar,
                    ...styles.courseMergedPeekToggle,
                    flex: 1,
                    minWidth: 0,
                    opacity: isAiSearching ? 0.92 : 1,
                  }}
                  onClick={() => setAiSheetOpen((open) => !open)}
                >
                  <div style={{ ...styles.aiPeekLeft, gap: "8px" }}>
                    <div style={styles.aiPeekTextWrap}>
                      <div style={{ ...styles.aiPeekTitle, ...styles.courseAiPeekTitle }}>
                        {courseError && !courseOptions.length
                          ? "코스를 찾지 못했어요"
                          : `추천 코스 ${courseOptions.length}가지`}
                      </div>
                      <div
                        style={{
                          ...styles.aiPeekSubtitle,
                          ...styles.courseAiPeekSubtitle,
                        }}
                      >
                        {courseError && !courseOptions.length ? (
                          courseError
                        ) : (
                          <span>
                            {aiSummary || "눌러서 코스 상세 보기"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={styles.aiPeekArrow}>{aiSheetOpen ? "▾" : "▴"}</span>
                </button>
              </div>

              {aiSheetOpen ? (
                <div style={styles.courseMergedBody}>
                  <div
                    ref={coursePullStripRef}
                    style={styles.courseSheetPullStrip}
                    aria-hidden
                  >
                    <div style={styles.courseSheetPullStripBar} />
                  </div>
                  {courseError ? (
                    <p
                      style={{
                        margin: "12px 16px",
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "#5c4033",
                      }}
                    >
                      {courseError}
                    </p>
                  ) : null}
                  <div style={styles.courseSheetBody}>
                    {courseStepPatternHint ? (
                      <p
                        style={{
                          margin: "6px 10px 0",
                          padding: "8px 10px",
                          fontSize: 11,
                          lineHeight: 1.45,
                          color: "#5c4033",
                          background: "rgba(255,255,255,0.72)",
                          borderRadius: 10,
                          border: "1px solid rgba(124, 58, 237, 0.15)",
                        }}
                      >
                        {courseStepPatternHint}
                      </p>
                    ) : null}
                    {!courseError && courseOptions.length > 0 ? (
                      <div
                        style={{
                          flexShrink: 0,
                          padding: "8px 10px 10px",
                          background: "rgba(250,245,255,0.55)",
                          borderBottom: "1px solid rgba(124, 58, 237, 0.12)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#5b21b6",
                            marginBottom: 6,
                          }}
                        >
                          조합 만들기
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#3d2914",
                            lineHeight: 1.45,
                          }}
                        >
                          <span style={{ color: "#888" }}>1차</span>{" "}
                          {courseComposePick1?.steps?.[0]?.place?.name ?? "—"}
                          <span style={{ margin: "0 8px", color: "#d4c4f0" }}>|</span>
                          <span style={{ color: "#888" }}>2차</span>{" "}
                          {courseComposePick2?.steps?.[1]?.place?.name ?? "—"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            marginTop: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            disabled={!courseComposePick1 && !courseComposePick2}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(92, 64, 51, 0.2)",
                              background: "rgba(255,255,255,0.95)",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#5c4033",
                              cursor:
                                courseComposePick1 || courseComposePick2
                                  ? "pointer"
                                  : "default",
                              opacity:
                                courseComposePick1 || courseComposePick2 ? 1 : 0.45,
                            }}
                            onClick={() => {
                              setCourseComposePick1(null);
                              setCourseComposePick2(null);
                            }}
                          >
                            초기화
                          </button>
                          <button
                            type="button"
                            disabled={!courseComposePick1 || !courseComposePick2}
                            style={{
                              flex: "1 1 120px",
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "none",
                              background:
                                courseComposePick1 && courseComposePick2
                                  ? "rgba(124, 58, 237, 0.95)"
                                  : "rgba(0,0,0,0.08)",
                              fontSize: 12,
                              fontWeight: 800,
                              color: "#fff",
                              cursor:
                                courseComposePick1 && courseComposePick2
                                  ? "pointer"
                                  : "not-allowed",
                              opacity:
                                courseComposePick1 && courseComposePick2 ? 1 : 0.55,
                            }}
                            onClick={() => {
                              if (
                                !courseComposePick1 ||
                                !courseComposePick2 ||
                                !applyComposedCourseFromPicks(
                                  courseComposePick1,
                                  courseComposePick2
                                )
                              ) {
                                return;
                              }
                              setCourseComposePick1(null);
                              setCourseComposePick2(null);
                            }}
                          >
                            이 조합으로 코스 적용
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <>
                    <div
                      ref={courseSwipeRowRef}
                      style={styles.courseOptionsSwipeRow}
                      onScroll={onCourseSwipeRowScroll}
                    >
                    {courseOptions.map((course, index) => {
                      const isSel = selectedCourse?.key === course.key;
                      const legM = getCourseLegMeters(course);
                      const courseWalkHint =
                        legM != null ? getCourseWalkComfortHint(legM) : "";
                      const legSummary = formatCourseLegDistanceSummary(course);
                      const pick1This = courseComposePick1?.key === course.key;
                      const pick2This = courseComposePick2?.key === course.key;
                      const pickChip = {
                        flexShrink: 0,
                        padding: "4px 10px",
                        borderRadius: 8,
                        border: "1px solid rgba(124, 58, 237, 0.35)",
                        background: "rgba(255,255,255,0.98)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#5b21b6",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      };
                      return (
                      <div
                        key={course.key || index}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (course.key !== selectedCourse?.key) {
                            setCourseComposePick1(null);
                            setCourseComposePick2(null);
                          }
                          chooseCourse(course);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (course.key !== selectedCourse?.key) {
                              setCourseComposePick1(null);
                              setCourseComposePick2(null);
                            }
                            chooseCourse(course);
                          }
                        }}
                        style={{
                          ...styles.courseOptionCardSwipe,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.92)",
                          border: isSel
                            ? "2px solid rgba(124, 58, 237, 0.55)"
                            : "1px solid rgba(92, 64, 51, 0.12)",
                          boxShadow: isSel
                            ? "0 6px 18px rgba(124, 58, 237, 0.15)"
                            : "0 4px 14px rgba(0,0,0,0.06)",
                          cursor: "pointer",
                          outline: "none",
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            marginBottom: 6,
                            color: "#3d2914",
                          }}
                        >
                          {course.profileTitle || `코스 ${index + 1}`}
                        </div>
                        {course.profileDescription ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#666",
                              marginBottom: 10,
                              lineHeight: 1.4,
                            }}
                          >
                            {course.profileDescription}
                          </div>
                        ) : null}
                        {legSummary ? (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#5b21b6",
                              marginBottom: 8,
                              lineHeight: 1.45,
                            }}
                          >
                            1차→2차 {legSummary}
                          </div>
                        ) : null}
                        <p
                          style={{
                            margin: "0 0 12px",
                            fontSize: 12,
                            color: "#444",
                            lineHeight: 1.45,
                          }}
                        >
                          {buildCourseSummary(course)}
                        </p>
                        {course.profileKey === "my_own" ? (
                          <div
                            style={{
                              marginBottom: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            {(() => {
                              const snap = snapshotFromMyOwnCourse(course);
                              const saved =
                                snap.pairKey &&
                                savedMyCoursePairKeys.has(snap.pairKey);
                              return (
                                <button
                                  type="button"
                                  disabled={Boolean(saved)}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 999,
                                    border: saved
                                      ? "1px solid rgba(34, 197, 94, 0.45)"
                                      : "1px solid rgba(124, 58, 237, 0.45)",
                                    background: saved
                                      ? "rgba(220, 252, 231, 0.95)"
                                      : "rgba(250,245,255,0.98)",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: saved ? "#166534" : "#5b21b6",
                                    cursor: saved ? "default" : "pointer",
                                    opacity: saved ? 0.9 : 1,
                                  }}
                                  onClick={(e) => {
                                    if (saved) return;
                                    void handleSaveMyOwnCourse(course, e);
                                  }}
                                >
                                  {saved ? "저장됨" : "코스 저장"}
                                </button>
                              );
                            })()}
                          </div>
                        ) : null}
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: "#333" }}>
                          <div style={{ marginBottom: 8 }}>
                            <strong>{course.steps[0]?.label}</strong>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 4,
                              }}
                            >
                              <button
                                type="button"
                                style={{
                                  flex: "1 1 120px",
                                  minWidth: 0,
                                  padding: 0,
                                  border: "none",
                                  background: "none",
                                  color: "#6b4f2a",
                                  fontWeight: 600,
                                  textAlign: "left",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const raw =
                                    course.steps[0]?.place?._raw ||
                                    course.steps[0]?.place;
                                  if (!raw) return;
                                  setSelectedPlaceWithAnalytics(
                                    mergePickedPlaceWithCuratorCatalog(
                                      raw,
                                      curatorPlaceCatalogForMerge
                                    ),
                                    "course_step1"
                                  );
                                }}
                              >
                                {course.steps[0]?.place?.name}
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...pickChip,
                                  background: pick1This
                                    ? "rgba(250,245,255,0.98)"
                                    : "rgba(255,255,255,0.98)",
                                  border: pick1This
                                    ? "1px solid rgba(124, 58, 237, 0.65)"
                                    : "1px solid rgba(124, 58, 237, 0.35)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCourseComposePick1((prev) =>
                                    prev?.key === course.key ? null : course
                                  );
                                }}
                              >
                                {pick1This ? "1차 담음" : "1차 담기"}
                              </button>
                            </div>
                            <div style={{ color: "#666", marginTop: 4 }}>
                              체류 약{" "}
                              {formatCourseStayMinutes(
                                course.steps[0]?.stayMinutes
                              )}
                            </div>
                            {getCourseOpenStatusText(course.steps[0]?.place) ? (
                              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                {getCourseOpenStatusText(course.steps[0]?.place)}
                              </div>
                            ) : null}
                          </div>
                          <div
                            style={{
                              margin: "10px 0",
                              fontSize: 12,
                              color: "#666",
                            }}
                          >
                            1차 → 2차{" "}
                            {formatCourseWalkApprox(
                              legM ?? course.steps[1]?.walkDistanceMeters
                            )}
                            {courseWalkHint ? (
                              <span style={{ display: "block", marginTop: 4 }}>
                                {courseWalkHint}
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <strong>{course.steps[1]?.label}</strong>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 4,
                              }}
                            >
                              <button
                                type="button"
                                style={{
                                  flex: "1 1 120px",
                                  minWidth: 0,
                                  padding: 0,
                                  border: "none",
                                  background: "none",
                                  color: "#6b4f2a",
                                  fontWeight: 600,
                                  textAlign: "left",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const raw =
                                    course.steps[1]?.place?._raw ||
                                    course.steps[1]?.place;
                                  if (!raw) return;
                                  setSelectedPlaceWithAnalytics(
                                    mergePickedPlaceWithCuratorCatalog(
                                      raw,
                                      curatorPlaceCatalogForMerge
                                    ),
                                    "course_step2"
                                  );
                                }}
                              >
                                {course.steps[1]?.place?.name}
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...pickChip,
                                  background: pick2This
                                    ? "rgba(250,245,255,0.98)"
                                    : "rgba(255,255,255,0.98)",
                                  border: pick2This
                                    ? "1px solid rgba(124, 58, 237, 0.65)"
                                    : "1px solid rgba(124, 58, 237, 0.35)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCourseComposePick2((prev) =>
                                    prev?.key === course.key ? null : course
                                  );
                                }}
                              >
                                {pick2This ? "2차 담음" : "2차 담기"}
                              </button>
                            </div>
                            <div style={{ color: "#666", marginTop: 4 }}>
                              체류 약{" "}
                              {formatCourseStayMinutes(
                                course.steps[1]?.stayMinutes
                              )}
                            </div>
                            {getCourseOpenStatusText(course.steps[1]?.place) ? (
                              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                {getCourseOpenStatusText(course.steps[1]?.place)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                    })}
                    </div>
                    {selectedCourse && courseOptions.length ? (
                      <div
                        style={{
                          padding: "4px 10px 8px",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            fontSize: 11,
                            color: "#888",
                            lineHeight: 1.45,
                            marginBottom: 2,
                          }}
                        >
                          지도 선은 길을 따라 표시됩니다.
                        </div>
                        {(() => {
                          const courseChipBusy =
                            isRefreshingCourses ||
                            isRegeneratingSecond ||
                            isRegeneratingFirst;
                          const neutralChip = {
                            border: "1px solid rgba(92, 64, 51, 0.18)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            background: "rgba(255,255,255,0.95)",
                            fontSize: 12,
                            color: "#3d2914",
                            cursor: courseChipBusy ? "wait" : "pointer",
                            opacity: courseChipBusy ? 0.65 : 1,
                          };
                          return (
                            <>
                              <button
                                type="button"
                                disabled={courseChipBusy}
                                style={{
                                  border: "1px solid rgba(124, 58, 237, 0.35)",
                                  borderRadius: 999,
                                  padding: "8px 12px",
                                  background: "rgba(250,245,255,0.98)",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#5b21b6",
                                  cursor: courseChipBusy ? "wait" : "pointer",
                                  opacity: courseChipBusy ? 0.65 : 1,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void rerunDifferentCourses();
                                }}
                              >
                                {isRefreshingCourses
                                  ? "다른 코스 찾는 중…"
                                  : "다른 코스로 다시 추천"}
                              </button>
                              <button
                                type="button"
                                disabled={courseChipBusy}
                                style={neutralChip}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void regenerateSelectedCourseFirst();
                                }}
                              >
                                {isRegeneratingFirst
                                  ? "1차 찾는 중…"
                                  : "1차만 다시"}
                              </button>
                              <button
                                type="button"
                                disabled={courseChipBusy}
                                style={neutralChip}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void regenerateSelectedCourseSecond("same");
                                }}
                              >
                                {isRegeneratingSecond
                                  ? "2차 추천 중…"
                                  : "2차만 다시"}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                    {altFirstCourses.length > 0 ? (
                      <div style={{ padding: "0 12px 16px" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#3d2914",
                            marginBottom: 10,
                          }}
                        >
                          다른 1차 추천
                        </div>
                        {altFirstCourses.map((course) => (
                          <div
                            key={course.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => applyAlternativeFirst(course)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                applyAlternativeFirst(course);
                              }
                            }}
                            style={{
                              border: "1px solid rgba(92, 64, 51, 0.14)",
                              borderRadius: 14,
                              padding: "12px 14px",
                              background: "rgba(255,255,255,0.96)",
                              marginBottom: 10,
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>2차 유지</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[1]?.place?.name}
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                padding: "8px 0",
                              }}
                            >
                              도보 약{" "}
                              {formatCourseWalkApprox(
                                course.steps[1]?.walkDistanceMeters
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>새 1차</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[0]?.place?.name}
                              </div>
                              <div style={{ color: "#666", marginTop: 4 }}>
                                체류 약{" "}
                                {formatCourseStayMinutes(
                                  course.steps[0]?.stayMinutes
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {altSecondCourses.length > 0 ? (
                      <div style={{ padding: "0 12px 16px" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#3d2914",
                            marginBottom: 10,
                          }}
                        >
                          다른 2차 추천
                        </div>
                        {altSecondCourses.map((course) => (
                          <div
                            key={course.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => applyAlternativeSecond(course)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                applyAlternativeSecond(course);
                              }
                            }}
                            style={{
                              border: "1px solid rgba(92, 64, 51, 0.14)",
                              borderRadius: 14,
                              padding: "12px 14px",
                              background: "rgba(255,255,255,0.96)",
                              marginBottom: 10,
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>1차 유지</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[0]?.place?.name}
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                padding: "8px 0",
                              }}
                            >
                              {getRegenerateSecondLabel(course.regenerateVariant)} ·{" "}
                              {formatCourseWalkApprox(
                                course.steps[1]?.walkDistanceMeters
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: "#5c4033" }}>
                              <strong>새 2차</strong>
                              <div style={{ marginTop: 4 }}>
                                {course.steps[1]?.place?.name}
                              </div>
                              <div style={{ color: "#666", marginTop: 4 }}>
                                체류 약{" "}
                                {formatCourseStayMinutes(
                                  course.steps[1]?.stayMinutes
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    </>

                  </div>
                </div>
              ) : null}
            </div>
          ) : aiRecommendedIds.length > 0 && !simpleMapSearchMarkersOnly ? (
            <>
              <button
                type="button"
                style={{
                  ...styles.aiPeekBar,
                  opacity: isAiSearching ? 0.92 : 1,
                }}
                onClick={() => {
                  setAiSheetOpen((open) => !open);
                  if (displayedPlaces.length > 0) {
                    const kakaoFormattedPlaces = displayedPlaces.map((place) => ({
                      ...place,
                      lat: parseFloat(place.y ?? place.lat),
                      lng: parseFloat(place.x ?? place.lng),
                      name: place.name || place.place_name,
                      place_name: place.place_name,
                      address_name: place.address_name || place.road_address_name,
                      category_name: place.category_name,
                      phone: place.phone || "",
                      id: place.id,
                      isExternal: true,
                      isLive: true,
                      kakao_place_id: place.id,
                      isKakaoPlace:
                        place.isKakaoPlace ||
                        (!place.primaryCurator &&
                          (Boolean(place.kakao_place_id) ||
                            place.isExternal === true)),
                    }));
                    console.log("🗺️ 카드 결과를 지도 마커로 변환:", kakaoFormattedPlaces);
                    setKakaoPlaces(kakaoFormattedPlaces);
                  }
                }}
              >
                <div style={styles.aiPeekLeft}>
                  <span style={styles.aiPeekBadge}>맞춤</span>

                  <div style={styles.aiPeekTextWrap}>
                    <div style={styles.aiPeekTitle}>
                      {isAiSearching
                        ? "추천 리스트 준비 중"
                        : aiError
                        ? "추천 결과를 불러오지 못했어요"
                        : `추천 결과 ${displayedPlaces.length}곳`}
                    </div>

                    <div
                      style={{
                        ...styles.aiPeekSubtitle,
                        ...(aiError ? styles.aiPeekSubtitleError : {}),
                      }}
                    >
                      {isAiSearching
                        ? `${searchLoadingLabel || "검색어·거리 기준으로 후보를 골라요"}${loadingDots}`
                        : aiError
                        ? "잠시 후 다시 시도해 주세요"
                        : aiSummary || "눌러서 리스트 보기"}
                    </div>
                  </div>
                </div>

                <span style={styles.aiPeekArrow}>{aiSheetOpen ? "▾" : "▴"}</span>
              </button>

              {aiSheetOpen ? (
                <div style={styles.aiBottomSheet}>
                  <div style={styles.aiSheetHandleWrap}>
                    <div style={styles.aiSheetHandle} />
                  </div>

                  {yajangFallbackBanner ? (
                    <div
                      style={{
                        margin: "0 16px 12px",
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(46, 204, 113, 0.12)",
                        border: "1px solid rgba(46, 204, 113, 0.35)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "#1a2e22",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        {yajangFallbackBanner.title}
                      </div>
                      <div>{yajangFallbackBanner.body}</div>
                    </div>
                  ) : null}

                  <div style={styles.aiSheetList}>
                    {displayedPlaces.length > 0 ? (
                      <div style={styles.aiSheetSectionLabel}>추천 순서 · 장소</div>
                    ) : null}
                    {displayedPlaces.map((place, index) => {
                      const distanceLabel = getRecommendationListDistanceLabel(place);
                      const extras = searchResultSheetExtras.byId.get(String(place.id)) || {
                        matched: [],
                        rep: "",
                        why: "",
                      };
                      const storyLine =
                        extras.why ||
                        topReasonMap[place.id] ||
                        place.recommendation ||
                        null;
                      const cc =
                        typeof place.curatorCount === "number" &&
                        place.curatorCount > 0
                          ? place.curatorCount
                          : null;
                      const sheetTags = filterPlaceTagsForDisplay(
                        place.tags || []
                      );

                      return (
                      <button
                        key={place.id}
                        type="button"
                        style={styles.aiSheetItem}
                        onClick={() => {
                          setSelectedPlaceWithAnalytics(place, "search_result");
                          setAiSheetOpen(false);
                          const lat = parseFloat(place.y ?? place.lat);
                          const lng = parseFloat(place.x ?? place.lng);
                          if (
                            Number.isFinite(lat) &&
                            Number.isFinite(lng) &&
                            mapRef?.current?.moveToLocation
                          ) {
                            mapRef.current.moveToLocation(lat, lng);
                          }
                          const doRelayout = () =>
                            mapRef.current?.relayout?.();
                          requestAnimationFrame(doRelayout);
                          setTimeout(doRelayout, 100);
                          setTimeout(doRelayout, 320);
                        }}
                      >
                        <div style={styles.aiSheetItemTop}>
                          <div style={styles.aiSheetRank}>{index + 1}</div>

                          <div style={styles.aiSheetMain}>
                            <div style={styles.aiSheetNameRow}>
                              <span style={styles.aiSheetName}>{place.name || place.place_name || '알 수 없는 장소'}</span>
                            </div>

                            <div style={styles.aiSheetMeta}>
                              {place.address || place.address_name || '주소 정보 없음'}
                            </div>

                            {distanceLabel ? (
                              <div style={styles.aiSheetDistance}>
                                {distanceLabel}
                              </div>
                            ) : null}

                            {storyLine ? (
                              <div style={styles.aiSheetWhyRecommended}>
                                {storyLine}
                              </div>
                            ) : null}

                            {extras.rep ? (
                              <div style={styles.aiSheetRepTagRow}>
                                <span style={styles.aiSheetRepTag}>대표 · {extras.rep}</span>
                              </div>
                            ) : null}

                            {extras.matched.length > 0 ? (
                              <div style={styles.aiSheetMatchRow}>
                                <span style={styles.aiSheetMatchLabel}>맞춘 조건</span>
                                <div style={styles.aiSheetFacetPills}>
                                  {extras.matched.map((lab) => (
                                    <span key={lab} style={styles.aiSheetFacetPill}>
                                      {lab}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {cc != null ? (
                              <div style={styles.aiSheetCuratorSave}>
                                저장한 큐레이터 {cc}명
                              </div>
                            ) : null}

                            {sheetTags.length > 0 ? (
                              <div style={styles.aiSheetTags}>
                                {sheetTags.slice(0, 4).map((tag) => (
                                  <span key={tag} style={styles.aiSheetTag}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                      );
                    })}

                    {curatorSearchHighlightList.length > 0 ? (
                      <>
                        <div style={{ ...styles.aiSheetSectionLabel, marginTop: 14 }}>
                          큐레이터
                        </div>
                        {curatorSearchHighlightList.map((h) => (
                          <button
                            key={h.key}
                            type="button"
                            style={styles.aiCuratorHighlight}
                            onClick={() => {
                              setShowAll(false);
                              setSelectedCurators([
                                canonicalCuratorChipToken(
                                  h.curatorUsername,
                                  dbCurators
                                ),
                              ]);
                              setAiSheetOpen(false);
                            }}
                          >
                            <div style={styles.aiCuratorHighlightHead}>{h.headline}</div>
                            <div style={styles.aiCuratorHighlightSub}>{h.sub}</div>
                          </button>
                        ))}
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* 네이버 블로그 리뷰 섹션 */}
              {blogReviews.length > 0 && (
                <div style={{
                  marginTop: "16px",
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "12px",
                  borderTop: "1px solid #e9ecef"
                }}>
                  <div style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#495057",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <span>📝</span>
                    네이버 블로그 실제 리뷰 ({blogReviews.length}개)
                  </div>
                  <div style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}>
                    {blogReviews.slice(0, 3).map((review, index) => (
                      <div key={index} style={{
                        padding: "8px",
                        backgroundColor: "white",
                        borderRadius: "8px",
                        border: "1px solid #e9ecef"
                      }}>
                        <div style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color: "#e74c3c",
                          marginBottom: "4px"
                        }}>
                          {review.place_name}
                        </div>
                        <div style={{
                          fontSize: "11px",
                          color: "#666",
                          lineHeight: "1.4",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}>
                          {review.content && review.content !== "내용 추출 실패" 
                            ? review.content.length > 100 
                              ? review.content.substring(0, 100) + "..."
                              : review.content
                            : "리뷰 내용을 불러오지 못했습니다."
                          }
                        </div>
                        {review.publish_date && review.publish_date !== "작성일 없음" && (
                          <div style={{
                            fontSize: "10px",
                            color: "#999",
                            marginTop: "4px"
                          }}>
                            {review.publish_date}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {blogReviews.length > 3 && (
                    <div style={{
                      fontSize: "11px",
                      color: "#999",
                      textAlign: "center",
                      marginTop: "8px"
                    }}>
                      외 {blogReviews.length - 3}개의 리뷰 더보기
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>


      <SavedPlaces
        open={savedPlacesOpen}
        folders={folders}
        savedPlacesByFolder={savedPlacesByFolder}
        onClose={() => setSavedPlacesOpen(false)}
        getUserRole={getUserRole}
      />

      <AddPlaceForm
        open={addPlaceOpen}
        curators={dbCurators}
        onClose={() => setAddPlaceOpen(false)}
        onAdded={refreshCustomPlaces}
      />

      <SaveFolderModal
        open={!!saveTargetPlace}
        place={saveTargetPlace}
        folders={folders}
        savedFolderIds={
          saveTargetPlace ? getPlaceFolderIds(saveTargetPlace.id) : []
        }
        onClose={() => {
          setSaveTargetPlace(null);
          // 저장 완료 후 폴더 정보 다시 로드
          loadUserSavedPlaces();
        }}
        onFoldersUpdated={() => {
          refreshStorage();
          // 폴더 업데이트 후 폴더 정보 다시 로드
          loadUserSavedPlaces();
        }}
        onSaveToFolder={(pId, fId) => {
          savePlaceToFolder(pId, fId);
          refreshStorage();
        }}
      />

      {/* UserCard - 일반 사용자용 */}
      <UserCard
        user={user}
        isVisible={showUserCard}
        onClose={() => setShowUserCard(false)}
        onPublicProfileSaved={refreshMapUserProfile}
      />

    </div>
      </>
  );
}

const glassWhiteStrong = "rgba(255, 255, 255, 0.9)";
const glassBorder = "1px solid rgba(255, 255, 255, 0.55)";
const floatingShadow = "0 10px 30px rgba(0, 0, 0, 0.16)";

const styles = {
  page: {
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "#000",
  },

  mainContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
  },

  headerOverlay: {
    position: "absolute",
    top: "16px",
    left: "16px",
    right: "16px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    /** 지도 SDK·하단 UI(z~1e4)보다 위에 두고, 새 스택킹 문맥으로 히트 테스트 안정화 */
    zIndex: 25000,
    isolation: "isolate",
    pointerEvents: "auto",
    touchAction: "manipulation",
  },

  logoStack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    flexShrink: 0,
    pointerEvents: "auto",
  },

  /** 로고 = 홈 전체 새로고침(상태 초기화) */
  logoHomeButton: {
    margin: 0,
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "30px",
    fontWeight: 900,
    letterSpacing: "-1.5px",
    color: "#111",
    lineHeight: 1,
    flexShrink: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  filterWrapper: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    overflowX: "auto",
    msOverflowStyle: "none",
    scrollbarWidth: "none",
    pointerEvents: "auto",
    position: "relative",
    zIndex: 1,
  },

  legendOverlay: {
    position: "absolute",
    top: "64px",
    right: "16px",
    left: "auto",
    width: "fit-content",
    maxWidth: "min(200px, 42vw)",
    zIndex: 55,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
    pointerEvents: "auto",
  },

  legendSecondPickResetButton: {
    pointerEvents: "auto",
    padding: "0 10px",
    height: "28px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.28)",
    background: "rgba(124, 58, 237, 0.35)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.14)",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 800,
    color: "rgba(250, 245, 255, 0.96)",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },

  legendMyLocationButton: {
    pointerEvents: "auto",
    width: "28px",
    height: "28px",
    borderRadius: "9px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(22, 24, 28, 0.22)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.14)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.92)",
    flexShrink: 0,
    transition: "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
  },

  legendMyLocationSpinner: {
    width: "11px",
    height: "11px",
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "rgba(125, 180, 255, 0.95)",
    borderRadius: "50%",
    animation: "judoSpin 1s linear infinite",
    display: "inline-block",
  },

  bottomBarContainer: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "18px",
    /* 헤더(16px 인셋)와 동일한 좌우 여백 — 90%는 뷰포트마다 측면이 어긋남 */
    width: "min(720px, calc(100% - 32px))",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    /** 코스 시트(backdrop-filter)보다 위에 항상 그려지도록 */
    zIndex: 160,
  },

  searchWrapper: {
    flex: 1,
    minWidth: 0,
    minHeight: "54px",
    borderRadius: "18px",
    background: "transparent",
    overflow: "visible",
  },

  authRowInline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  authRowInlineNarrow: {
    gap: "4px",
  },

  /** @핸들 등 역할 버튼 — 좁은 화면에서 검색 입력 폭 확보 */
  inlineRoleButtonNarrow: {
    minWidth: 0,
    maxWidth: "78px",
    height: "32px",
    padding: "0 5px",
    fontSize: "11px",
    marginRight: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  authInlineButton: {
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(17, 17, 17, 0.74)",
    color: "#ffffff",
    borderRadius: "999px",
    height: "34px",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    pointerEvents: "auto",
  },

  authInlineButtonNarrow: {
    height: "32px",
    padding: "0 6px",
    fontSize: "10px",
    fontWeight: 800,
  },

  authIconButton: {
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "none",
    fontSize: "14px",
    fontWeight: 1000,
    padding: 0,
  },

  googleButton: {
    backgroundColor: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(0,0,0,0.12)",
  },

  kakaoButton: {
    backgroundColor: "#FEE500",
    border: "1px solid rgba(0,0,0,0.12)",
  },

  googleG: {
    color: "#4285F4",
    fontWeight: 1000,
    lineHeight: 1,
  },

  kakaoK: {
    color: "#111111",
    fontWeight: 1000,
    lineHeight: 1,
  },

  curatorFloatingWrap: {
    position: "absolute",
    right: "16px",
    bottom: "200px", // 내 위치 아이콘보다 아래
    zIndex: 10050,
  },

  curatorFloatingBtn: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "20px",
    border: glassBorder,
    background: "rgba(46, 204, 113, 0.9)", // 초록색
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontSize: "12px",
    fontWeight: "600",
    padding: "0 12px",
    transition: "all 0.2s ease",
  },

  curatorFloatingText: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "11px",
  },

  curatorApplyBtn: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "20px",
    border: glassBorder,
    background: "rgba(46, 204, 113, 0.9)", // 초록색
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontSize: "12px",
    fontWeight: "600",
    padding: "0 12px",
    transition: "all 0.2s ease",
  },

  locationBtn: {
    width: "54px",
    height: "54px",
    flexShrink: 0,
    borderRadius: "18px",
    border: glassBorder,
    background: glassWhiteStrong,
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: floatingShadow,
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },

  userInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(52, 152, 219, 0.3)",
    background: "rgba(52, 152, 219, 0.15)",
    color: "#3498DB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  curatorInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(46, 204, 113, 0.3)",
    background: "rgba(46, 204, 113, 0.15)",
    color: "#2ECC71",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  adminInlineButton: {
    minWidth: "80px",
    maxWidth: "120px",
    height: "38px",
    borderRadius: "18px",
    border: "1px solid rgba(255, 107, 107, 0.3)",
    background: "rgba(255, 107, 107, 0.15)",
    color: "#FF6B6B",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 12px",
    marginRight: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },

  /** 검색바 우측 프로필 — 원형 사진(역할색 링은 위 버튼 스타일 유지) */
  searchBarProfileButton: {
    minWidth: "34px",
    maxWidth: "34px",
    width: "34px",
    height: "34px",
    padding: 0,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    fontSize: "13px",
    fontWeight: 800,
  },
  searchBarProfileButtonNarrow: {
    minWidth: "28px",
    maxWidth: "28px",
    width: "28px",
    height: "28px",
    fontSize: "11px",
  },
  searchBarProfileImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    pointerEvents: "none",
  },
  searchBarProfileInitial: {
    lineHeight: 1,
    userSelect: "none",
    pointerEvents: "none",
  },

  sideFabContainer: {
    position: "absolute",
    right: "16px",
    bottom: "88px",
    zIndex: 95,
  },

  fabAdd: {
    height: "46px",
    padding: "0 16px",
    borderRadius: "23px",
    border: "1px solid rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.88)",
    color: "#111",
    fontWeight: 700,
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },

  fabPlus: {
    fontSize: "18px",
    lineHeight: 1,
    marginTop: "-1px",
  },

  aiStatusBox: {
    position: "absolute",
    left: "16px",
    right: "16px",
    bottom: "82px",
    zIndex: 72,
    padding: "12px 14px",
    borderRadius: "18px",
    background: "rgba(17,17,17,0.82)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  },

  aiStatusInner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  aiSpinner: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    border: "2px solid rgba(255,255,255,0.24)",
    borderTop: "2px solid #34D17A",
    flexShrink: 0,
    animation: "judoSpin 0.9s linear infinite",
  },

  aiStatusTextWrap: {
    minWidth: 0,
    flex: 1,
  },

  aiStatusTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#fff",
  },

  aiStatusSubtext: {
    marginTop: "3px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.78)",
    lineHeight: 1.4,
  },

  aiStatusError: {
    marginTop: "3px",
    fontSize: "12px",
    color: "#ffb4b4",
    lineHeight: 1.4,
  },

  mapCardOverlay: {
    position: "absolute",
    left: "16px",
    right: "16px",
    bottom: "100px",
    zIndex: 40,
    pointerEvents: "none",
    /** 코스·AI 카드: 내용을 오버레이 하단(검색바 쪽)에 붙여 지도가 위로 넓게 보이게 */
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "stretch",
  },

  expandSearchWrap: {
    pointerEvents: "auto",
    maxWidth: "100%",
  },

  expandSearchCard: {
    borderRadius: "18px",
    padding: "16px 16px 12px",
    background: "rgba(22, 22, 26, 0.92)",
    color: "#fff",
    boxShadow: "0 12px 36px rgba(0,0,0,0.28)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  expandSearchTitle: {
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.35,
    marginBottom: "8px",
  },

  expandSearchNote: {
    margin: "0 0 6px",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.88)",
  },

  expandSearchSub: {
    margin: "0 0 12px",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.62)",
  },

  expandFallbackHints: {
    margin: "0 0 12px",
    paddingLeft: "18px",
    fontSize: "11px",
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.55)",
  },

  expandChipCol: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "12px",
  },

  expandPrimaryBtn: {
    width: "100%",
    marginTop: "4px",
    border: "none",
    borderRadius: "14px",
    padding: "14px 14px",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.35,
    color: "#0d1f14",
    background: "linear-gradient(135deg, #5ee9a8 0%, #34d17a 55%, #2bbd6e 100%)",
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(52, 209, 122, 0.35)",
  },

  expandChip: {
    textAlign: "left",
    width: "100%",
    border: "1px solid rgba(52, 209, 122, 0.45)",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.35,
    color: "#e8fff1",
    background: "rgba(52, 209, 122, 0.12)",
    cursor: "pointer",
  },

  expandDismiss: {
    marginTop: "12px",
    width: "100%",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    cursor: "pointer",
    padding: "6px",
  },

  previewStack: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    pointerEvents: "none",
    alignItems: "center",
  },

  aiPeekBar: {
    width: "100%",
    border: "none",
    borderRadius: "18px",
    padding: "14px 16px",
    background: "rgba(17,17,17,0.82)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    pointerEvents: "auto",
    cursor: "pointer",
  },

  /** 코스 모드 피크 바 — 얇게 */
  courseAiPeekBar: {
    padding: "7px 12px",
    borderRadius: "14px",
    boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
  },

  /** 코스 모드 — 검색어 지우고 완전히 취소 (작은 원형) */
  courseSearchClearButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    minWidth: "26px",
    padding: 0,
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.28)",
    background: "rgba(0,0,0,0.28)",
    color: "rgba(255,255,255,0.88)",
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: 400,
    cursor: "pointer",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  },

  /** 코스 모드 — 1차·2차 확정된 선택 코스만 비움 (검색어 유지). 검색 전체 취소 버튼과 구분 */
  courseResetPickButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    minWidth: "26px",
    padding: 0,
    borderRadius: "999px",
    border: "1px solid rgba(196, 181, 253, 0.7)",
    background: "rgba(124, 58, 237, 0.42)",
    color: "rgba(255,255,255,0.96)",
    fontSize: "15px",
    lineHeight: 1,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  },

  /** 코스 피크(제목) + 스와이프·액션을 한 덩어리 바텀시트로 */
  courseMergedShell: {
    width: "100%",
    marginTop: "6px",
    borderRadius: "16px 16px 0 0",
    overflow: "hidden",
    boxShadow: "0 -6px 24px rgba(0,0,0,0.14)",
    background: "transparent",
    /** 셸 전체에 auto 두면 투명 여백이 지도 팬을 가릴 수 있음 — 자식만 클릭 받음 */
    pointerEvents: "none",
    maxHeight: "min(58vh, 520px)",
    display: "flex",
    flexDirection: "column",
  },

  courseMergedHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px 8px 10px",
    background: "rgba(17,17,17,0.9)",
    flexShrink: 0,
    borderRadius: "16px 16px 0 0",
    pointerEvents: "auto",
  },

  courseMergedBody: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTop: "1px solid rgba(17,17,17,0.08)",
    background: "rgba(255,255,255,0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    pointerEvents: "auto",
  },

  /** 아래로 드래그해 시트 접기 — 손가락 당김 영역 */
  courseSheetPullStrip: {
    flexShrink: 0,
    height: "30px",
    touchAction: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
  },

  courseSheetPullStripBar: {
    width: "40px",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(17,17,17,0.16)",
  },

  /** 헤더 안에서는 별도 떠 있는 카드처럼 보이지 않게 */
  courseMergedPeekToggle: {
    background: "transparent",
    boxShadow: "none",
    borderRadius: 0,
    border: "none",
  },

  courseAiPeekTitle: {
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1.15,
  },

  courseAiPeekSubtitle: {
    fontSize: "10px",
    lineHeight: 1.2,
    maxWidth: "min(78vw, 300px)",
    whiteSpace: "normal",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: "1px",
  },

  aiPeekLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },

  aiPeekBadge: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "#34D17A",
    color: "#111",
    fontWeight: 900,
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  aiPeekTextWrap: {
    minWidth: 0,
    textAlign: "left",
  },

  aiPeekTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#fff",
  },

  aiPeekSubtitle: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.78)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "220px",
  },

  aiPeekSubtitleError: {
    color: "#ffb4b4",
  },

  aiPeekArrow: {
    flexShrink: 0,
    fontSize: "12px",
    lineHeight: 1,
    color: "rgba(255,255,255,0.9)",
    marginLeft: "6px",
  },

  aiBottomSheet: {
    marginTop: "10px",
    width: "100%",
    maxHeight: "24vh",
    borderRadius: "24px 24px 0 0",
    background: "rgba(255,255,255,0.85)",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.12)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    overflow: "hidden",
    pointerEvents: "auto",
    position: "relative",
    /** 부모 mapCardOverlay가 스트립보다 올라간 뒤에도 시트가 피크바 위에 보이도록 */
    zIndex: 2,
  },

  aiSheetHandleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "10px",
  },

  aiSheetHandle: {
    width: "42px",
    height: "5px",
    borderRadius: "999px",
    background: "rgba(17,17,17,0.18)",
  },

  aiSheetHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 16px 12px",
    borderBottom: "1px solid rgba(17,17,17,0.06)",
  },

  aiSheetTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#111",
  },

  aiSheetDesc: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#666",
    lineHeight: 1.4,
  },

  aiSheetCloseBtn: {
    border: "none",
    background: "rgba(17,17,17,0.06)",
    color: "#111",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  aiSheetCloseBtadminChip: {
    border: "1px solid rgba(0,0,0,0.10)",
    backgroundColor: "rgba(255,255,255,0.86)",
    color: "#111",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  studioChip: {
    border: "1px solid rgba(255,107,107,0.30)",
    backgroundColor: "rgba(255,107,107,0.15)",
    color: "#FF6B6B",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  aiSheetList: {
    maxHeight: "38vh",
    overflowY: "auto",
    padding: "8px 12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    pointerEvents: "auto",
  },

  /** 코스 바텀시트: 가로 스와이프 카드 + 아래 액션 영역 */
  courseSheetBody: {
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    pointerEvents: "auto",
  },

  courseOptionsSwipeRow: {
    display: "flex",
    flexDirection: "row",
    gap: "10px",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x mandatory",
    padding: "6px 12px 4px",
    flexShrink: 0,
    scrollbarWidth: "thin",
    touchAction: "pan-x",
    overscrollBehaviorX: "contain",
    maxHeight: "min(30vh, 248px)",
  },

  courseOptionCardSwipe: {
    flex: "0 0 min(calc(100vw - 56px), 288px)",
    width: "min(calc(100vw - 56px), 288px)",
    maxWidth: "min(calc(100vw - 56px), 288px)",
    scrollSnapAlign: "center",
    boxSizing: "border-box",
    maxHeight: "min(28vh, 228px)",
    overflowY: "auto",
  },

  aiSheetSectionLabel: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "rgba(17,17,17,0.45)",
    marginBottom: "2px",
  },

  aiSheetRepTagRow: {
    marginTop: "8px",
  },

  aiSheetRepTag: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#1b4332",
    background: "rgba(27, 67, 50, 0.08)",
    borderRadius: "999px",
    padding: "4px 10px",
  },

  aiSheetMatchRow: {
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  aiSheetMatchLabel: {
    fontSize: "10px",
    fontWeight: 800,
    color: "rgba(17,17,17,0.38)",
    letterSpacing: "0.02em",
  },

  aiSheetFacetPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },

  aiSheetFacetPill: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#111",
    border: "1px solid rgba(17,17,17,0.12)",
    borderRadius: "999px",
    padding: "5px 10px",
    background: "rgba(255,255,255,0.95)",
  },

  aiSheetCuratorSave: {
    marginTop: "8px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6c5ce7",
  },

  aiCuratorHighlight: {
    width: "100%",
    textAlign: "left",
    border: "1px solid rgba(108, 92, 231, 0.25)",
    borderRadius: "16px",
    padding: "12px 14px",
    background: "rgba(108, 92, 231, 0.06)",
    cursor: "pointer",
  },

  aiCuratorHighlightHead: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#111",
    lineHeight: 1.4,
  },

  aiCuratorHighlightSub: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "rgba(17,17,17,0.55)",
  },

  aiSheetItem: {
    width: "100%",
    border: "1px solid rgba(17,17,17,0.06)",
    borderRadius: "24px", 
    background: "rgba(255,255,255,0.9)",
    padding: "8px 12px", 
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)", 
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },

  aiSheetItemTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },

  aiSheetRank: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "#111",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  aiSheetMain: {
    minWidth: 0,
    flex: 1,
  },

  aiSheetNameRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  aiSheetName: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#111",
  },

  aiSavedDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    flexShrink: 0,
  },

  aiSheetMeta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#777",
  },

  aiSheetDistance: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#1b4332",
  },

  aiSheetReason: {
    marginTop: "8px",
    fontSize: "13px",
    color: "#222",
    lineHeight: 1.45,
  },

  aiSheetWhyRecommended: {
    marginTop: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#1a1a2e",
    lineHeight: 1.5,
  },

  aiSheetTags: {
    marginTop: "10px",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },

  aiSheetTag: {
    fontSize: "11px",
    color: "#555",
    background: "rgba(17,17,17,0.05)",
    borderRadius: "999px",
    padding: "6px 9px",
  },
};