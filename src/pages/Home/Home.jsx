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

import SearchBar from "../../components/SearchBar/SearchBar";
import HomeCuratorFilterRow from "../../components/Home/HomeCuratorFilterRow";
import HomeSearchAuthSlot from "../../components/Home/HomeSearchAuthSlot";
import UserCard from "../../components/UserCard/UserCard";
import MapView from "../../components/Map/MapView";
import HomeRecommendOverlay from "../../components/Home/HomeRecommendOverlay";
import HomeMapFloatingActions from "../../components/Home/HomeMapFloatingActions";
import HomeDustIntroOverlay from "../../components/Home/HomeDustIntroOverlay";
import CourseSecondFindModal from "../../components/Home/CourseSecondFindModal";
import HomeMapLegendBar from "../../components/Home/HomeMapLegendBar";
import HomeCourseMergedSheet from "../../components/Home/HomeCourseMergedSheet";
import HomeAiBottomSheetCluster from "../../components/Home/HomeAiBottomSheetCluster";
import { RecommendationMapOverlay } from "../../components/Recommendation/RecommendationMapOverlay";
import PlacePreviewCard from "../../components/PlaceCard/PlacePreviewCard";
import HomeBottomModalStack from "../../components/Home/HomeBottomModalStack";
import AnimatedToast from "../../components/AnimatedToast/AnimatedToast";
import CheckInToast from "../../components/CheckInToast/CheckInToast";

import { useAuth } from "../../context/AuthContext";

import { supabase } from "../../lib/supabase";
import { syncAuthProviderToProfile } from "../../lib/syncAuthProviderToProfile";
import { followUser } from "../../utils/userProfileFollows";

import {
  getFolders,
  getSavedPlacesMap,
  getPlaceFolderIds,
  getPrimarySavedFolderColor,
  isPlaceSaved,
  savePlaceToFolder,
} from "../../utils/storage";

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
  extractHomeMapLocationName,
  normalizeHangulSearchCompounds,
  shouldKeepExtractedLocationForMapSearch,
  isLikelyNaturalLanguageSearchQuery,
  HOME_SEARCH_KIND,
  detectHomeSearchExecutionKind,
  isMapGeographicPanOnlyQuery,
  getKakaoKeywordSuffix,
  stripPartyAndChatterForKeywordSearch,
  homeSearchQueryHasMoodIntentHint,
  lockKeywordToClientForKakaoHint,
  filterPlacesByParsedIntent,
  buildRecommendationWhyLine,
  expandFoodKakaoQueries,
  kakaoMapSearchWantsBroadPlaceCategories,
  kakaoQueryHasGeographicAnchor,
  buildAiParseMapFallbackQueries,
  filterPlacesForUnifiedMapBackupRestore,
  filterMapSearchPlacesByRegionProximity,
  queryWantsSeafoodFocus,
  isObviousNonSeafoodKakaoPlace,
  queryWantsYajangFocus,
  queryWantsDayDrinkFocus,
  YAJANG_PLACE_HINT_RE,
  placeSignalsYajangCuratorMeta,
  placeSignalsDayDrinkCuratorMeta,
} from "../../utils/searchParser";
import { buildCuratorSearchHighlights } from "../../utils/searchCuratorHighlights";
import { getSearchLoadingMessage } from "../../utils/searchLoadingMessage";
import { fetchSearchIntentAssist } from "../../utils/searchAIAssistant";
import { buildExpansionSuggestions } from "../../utils/searchExpansionSuggestions";
import { insertSearchLog, insertPlaceClickLog } from "../../utils/searchAnalytics";
import {
  normalizeQueryForFeedback,
  fetchSearchFeedbackBoostMap,
  placeKeyFromSearchLogResultId,
  intentTagsFromFacets,
  placeKeyForFeedback,
  computeSearchFeedbackBoost,
  rpcIncrementSearchPlaceFeedbackImpressions,
} from "../../utils/searchPlaceFeedback";
import HomeSearchAboveStrip from "../../components/Home/HomeSearchAboveStrip";
import HotCheckinStrip from "../../components/Home/HotCheckinStrip";
import HomeDesktopSocialStack from "../../components/Home/HomeDesktopSocialStack";
import HomeLoginPromptGate from "../../components/Home/HomeLoginPromptGate";
import HomeFollowCuratorModal from "../../components/Home/HomeFollowCuratorModal";
import { fetchUnifiedMapSearch } from "../../utils/fetchUnifiedMapSearch";
import {
  mergeMapSearchPlacesDedupe,
  mapPlaceStableDedupeKey,
} from "../../utils/mergeMapSearchPlacesDedupe";
import {
  dampedSearchSocialScoreDelta,
  fetchSearchSocialBoostByPlaces,
} from "../../utils/searchSocialBoost";
import { buildKakaoStaticMapUrl } from "../../utils/kakaoStaticMapUrl";
import {
  emitSearchTelemetry,
  KEYWORD_SEARCH_FALLBACK_MIN_RESULTS,
  summarizeSearchResultQualityForTelemetry,
  deriveSearchClickPath,
  shouldPreferFallbackSearchResults,
} from "../../utils/searchBranchTelemetry.js";
import {
  mergeIntentAssistIntoSearchPhrases,
  rawQueryBlindDateSecondVenueContext,
  rawQueryExplicitCafeMealCoffee,
} from "../../utils/mergeIntentAssistSearchPhrases";
import { enrichPlacesWithReason } from "../../utils/recommendReasonSignals";
import {
  fetchCuratorPlaceDbSearch,
  mergeDbPlaceIdsFirst,
} from "../../utils/fetchCuratorPlaceDbSearch";
import {
  resolvePlaceWgs84,
  haversineMeters,
  isLikelyKoreaWgs84,
} from "../../utils/placeCoords";
import { buildFormattedPlacesFromJoin } from "../../utils/buildFormattedPlacesFromJoin";
import { padLatLngBounds, filterJoinRowsToBounds } from "../../utils/fetchCuratorPlacesInBounds";
import { fetchMapPlacesInBounds } from "../../api/placesInBounds";
import { debounce } from "../../utils/debounce";
import {
  fetchPlaceDetail,
  fetchPlaceUuidByKakaoPlaceId,
  getLimitByZoom,
} from "../../api/places";
import { formatBoundsPlaceRowsForMap } from "../../utils/formatBoundsPlaceRowsForMap";
import {
  isWalkingRouteReasonable,
  walkingRouteDisplayMinutes,
  getCourseLongWalkStrollHint,
} from "../../utils/courseWalkingRouteQuality.js";
import { getKakaoPlaceBasicInfoViaProxy } from "../../utils/kakaoAPIProxy";
import { verifyTopKakaoSearchCandidates } from "../../utils/verifyTopKakaoSearchCandidates";
import {
  mergePickedPlaceWithCuratorCatalog,
  findCuratorCatalogMatch,
  dedupeMapPlacesByKakaoId,
  normalizeKakaoPlaceId,
} from "../../utils/mergePickedPlaceWithCuratorCatalog";
import { collectReasonEvidence } from "../../utils/reasonEvidence.js";
import { applyYajangCuratorFallbackIfEmpty } from "../../utils/curatorYajangFallback";
import { useLoginRequired } from "../../hooks/useLoginRequired";
import { useCourseSearch } from "../../hooks/useCourseSearch";
import { useRealtimeCheckins } from "../../hooks/useRealtimeCheckins";
import { useRecommendation } from "../../hooks/useRecommendation";
import { useSelectedRecommendedPlace } from "../../hooks/useSelectedRecommendedPlace";
import { useMapCenterOnFirstHighlighted } from "../../hooks/useMapCenterOnFirstHighlighted";
import { isCourseQuery } from "../../utils/isCourseQuery";
import {
  detectIntents,
  classifyCategory,
  applyIntentAxisScoresWithSignals,
  buildReasonFromSignals,
  INTENT_SIGNAL_REASON_FALLBACK,
} from "../../utils/intentAxisScoring";
import { getCourseLegMeters } from "../../utils/formatCourseUi";
import {
  fetchCourseWalkingRoute,
  fetchChainedCourseWalkingRoutes,
} from "../../utils/fetchCourseWalkingRoute.js";
import { fetchRegionOutline } from "../../utils/fetchRegionOutline.js";
import { buildCourseMapData } from "../../utils/buildCourseMapData";
import {
  courseOptionsToMapPlaces,
  courseSecondCandidatesToPulseMapPlaces,
  placeId,
} from "../../utils/generateCourseOptions.js";
import {
  filterPlacesBySituationFolder,
  SITUATION_FOLDER,
} from "../../utils/situationPlaceFilter";
import {
  getJudoModeCopy,
  getJudoOperationMode,
} from "../../utils/judoOperationMode";

import {
  AI_API_BASE,
  appendSelectedPlacePinIfMissing,
  applyLegendCategoryFilter,
  attachCuratorsToCuratorPlaceRows,
  buildMergedSavedPlaceKeySet,
  buildPlaceCuratorFilterKeySet,
  canonicalCuratorChipToken,
  collectCuratorIdsForRescueMatch,
  COURSE_GPS_DEFAULT_RADIUS_M,
  curatorRowProfileImage,
  DRINKS_SITUATION_CHIP_RESULT_HINTS,
  DRINKS_SITUATION_CHIP_SINGLE_SHOT_QUERY,
  DRINKS_SITUATION_CHIP_UNIFIED_PHRASES,
  EMPTY_LIVE_PLACE_IDS,
  expandCuratorChipSelectionKeys,
  findDbCuratorRowForChip,
  getCourseSwipeIndexFromScroll,
  getHomeSearchPlaceholderKst,
  HOME_CENTER_DUST_INTRO_KEY,
  HOME_SEARCH_IDLE_HINTS_KEY,
  logSignalsCheckDev,
  mapPanAnchorKeyword,
  MAP_PAN_STATION_ALIAS,
  MAP_SDK_MERGE_MAX_DEFAULT,
  MAP_SDK_MERGE_MAX_SITUATION_CHIP,
  mergeDbPlaceDetailForPreview,
  mergeSituationChipCuratorPlaces,
  placeMatchesSavedKeySet,
  readKakaoMapCenterLatLng,
  searchMapBottomChromePx,
  SEARCH_IDLE_HINT_MESSAGES,
  SEARCH_INTENT_ASSIST_MS,
  SEONGSU_MAP_CENTER,
  shuffleArray,
  SITUATION_CHIP_CURATOR_API_MAX_DISTANCE_M,
  SITUATION_CHIP_INTENT_RELAX_THRESHOLD,
  SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS,
  toHotStripRow,
  UNIFIED_MAP_MERGE_MAX_PHRASES,
} from "./homeModule.js";
import { styles } from "./homeStyles.js";
import { useAiSearchLoadingDots } from "./hooks/useAiSearchLoadingDots";
import { useTickingNow } from "./hooks/useTickingNow";
import { useMinuteTick } from "./hooks/useMinuteTick";
import { findMatchedMapPlace } from "../../utils/findMatchedMapPlace";
import { getHighlightedPlaces } from "../../utils/getHighlightedPlaces";
import { importReasonLineForPlace } from "../../utils/recommendationPlaceCopy";
import { orderPlacesByImportFirst } from "../../utils/orderPlacesByImportFirst";

export default function Home() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const { showToast } = useToast();

  const { user, loading: authLoading, signInWithProvider, signOut } = useAuth();

  /** follower_notifications 미사용 — 테이블 도입 시 supabase 쿼리 복원 */
  const checkUnreadFollowers = async (curatorId) => {
    void curatorId;
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

  /** 코스「내 주변」등: 거부 시 서울 폴백 없이 실패 처리. code 3(타임아웃)이면 저정밀·캐시로 1회 재시도 */
  const getCurrentUserLocationStrict = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation이 지원되지 않습니다."));
        return;
      }
      const onOk = (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ lat: latitude, lng: longitude });
      };
      const onErr = (error, didRetry) => {
        if (Number(error?.code) === 3 && !didRetry) {
          navigator.geolocation.getCurrentPosition(onOk, (e) => onErr(e, true), {
            enableHighAccuracy: false,
            timeout: 28000,
            maximumAge: 600000,
          });
          return;
        }
        reject(error);
      };
      navigator.geolocation.getCurrentPosition(onOk, (e) => onErr(e, false), {
        enableHighAccuracy: true,
        timeout: 28000,
        maximumAge: 60000,
      });
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
                  return YAJANG_PLACE_HINT_RE.test(haystack);
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
                  return YAJANG_PLACE_HINT_RE.test(haystack);
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

  const searchMapBars = async (keyword, regionAnchor = null) => {
    if (!window.kakao?.maps?.services || !mapRef.current) {
      console.error("❌ searchMapBars: 카카오 API 또는 맵 레퍼런스 없음");
      return [];
    }

    const rawKw = String(keyword || "").trim();
    const kwMap = homeSearchQueryHasMoodIntentHint(rawKw)
      ? rawKw
      : stripPartyAndChatterForKeywordSearch(keyword) || keyword;
    const mapBounds = mapRef.current.getBounds();
    if (!mapBounds) {
      console.error("❌ searchMapBars: 지도 영역 없음");
      return [];
    }

    const geoAnchored = situationChipMapSearchViewportRef.current
      ? false
      : kakaoQueryHasGeographicAnchor(kwMap, regionAnchor);
    const useApiBounds = !geoAnchored;
    const queries = expandFoodKakaoQueries(kwMap);

    console.log("🗺️ searchMapBars:", { kwMap, geoAnchored, useApiBounds, queries });

    const broadCategories = kakaoMapSearchWantsBroadPlaceCategories(kwMap);
    const runOne = (q) =>
      new Promise((resolve) => {
        const ps = new window.kakao.maps.services.Places();
        const opts = {
          sort: window.kakao.maps.services.SortBy.ACCURACY,
        };
        if (!broadCategories) opts.category_group_code = "FD6";
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

  /**
   * 카카오·통합 검색 후보 위 룰 기반 `aiScore`.
   * 기준: `scorePlace`(검색 파싱·facet) → 의도축(`applyIntentAxisScoresWithSignals`)·거리·피드백 등.
   * 보조: `place_picks`(일반 1·큐레이터 4 가중 합) + `check_ins`(한잔, 건당 5 가중) — 로그·cap·패널티 게이트
   * (`searchSocialBoost.js` + RPC `get_search_social_boost_batch`).
   * 한 줄 이유는 `enrichPlacesWithReason`에서 별도 부착. 정렬: 의미 점수와 거리 페널티.
   */
  const calculateLocalAIScores = (
    places,
    keyword,
    userLocation = null,
    sortOrigin = null,
    _scoreOpts = null
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
    const wantsDayDrink = queryWantsDayDrinkFocus(keyword);
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

    const blindDateSecondVenueContext =
      rawQueryBlindDateSecondVenueContext(keyword);
    const userAskedBudgetMeal =
      /해장|국밥|백반|분식|김밥|순대|기사식|도시락|죽\s*집|뼈\s*해장/.test(kwSc);
    const userExplicitCafeMealInQuery =
      rawQueryExplicitCafeMealCoffee(keyword);
    const barLikeReliefRe =
      /와인바|칵테일바|이자카야|펍|라운지|주점|포차|호프|술집|wine|winebar|cocktail/i;
    const misalignedSecondVenueMealCategoryRe =
      /백반|기사식|기사식당|분식|해장국|해장|국밥|순대국|김밥|도시락|구내식당|뼈\s*해장|브런치|팬케이크|pancake|팬\s*케이크|한끼|밥플러스|메가\s*커피|메가커피|카페|커피숍|커피\s*전문|디저트|베이커리|토스트|샌드위치|포케|뷔페|패스트푸드|패밀리|버거|샐러드|피자|파스타|스테이크|우동|라멘|국수|돈까스|초밥|삼겹살|고깃집|한우|죽\s*전문|죽집|한식음식점|중국요리|일식음식점|양식음식점|중식|한식당|한끼식사|밥\s*집|밥집/i;

    const intentAxisFlags = detectIntents(keyword);

    return places.map(place => {
      const catalogHit = findCuratorCatalogMatch(
        place,
        curatorPlaceCatalogForMerge || []
      );

      const evidencePlace = catalogHit
        ? {
            ...place,
            curatorReasons:
              catalogHit.curatorReasons ?? place.curatorReasons,
            curatorPlaces:
              Array.isArray(catalogHit.curatorPlaces) &&
              catalogHit.curatorPlaces.length
                ? catalogHit.curatorPlaces
                : place.curatorPlaces,
            tags:
              Array.isArray(catalogHit.tags) && catalogHit.tags.length
                ? catalogHit.tags
                : place.tags,
            vibes:
              Array.isArray(catalogHit.vibes) && catalogHit.vibes.length
                ? catalogHit.vibes
                : place.vibes,
            moods: catalogHit.moods ?? place.moods,
            food_types: catalogHit.food_types ?? place.food_types,
            alcohol_types: catalogHit.alcohol_types ?? place.alcohol_types,
            purposes: catalogHit.purposes ?? place.purposes,
            blogInsight: place.blogInsight ?? catalogHit.blogInsight,
          }
        : place;
      const reasonEvidence = collectReasonEvidence(evidencePlace);
      const placeForReason = { ...place, reasonEvidence };

      const facetResult = scorePlace(place, parsedFacets);
      let score = facetResult.score;
      const cat = `${place.category_name || ""} ${place.place_name || ""}`;
      const catLower = cat.toLowerCase();
      const overlapBoost = queryKeywordOverlapBoost(catLower);
      score += overlapBoost;
      const fbMap = _scoreOpts?.searchFeedbackByPlaceKey;
      let searchFeedbackBoost = 0;
      if (fbMap && typeof fbMap === "object") {
        const pk = placeKeyForFeedback(evidencePlace);
        const row = pk ? fbMap[pk] : null;
        if (row) {
          searchFeedbackBoost = computeSearchFeedbackBoost(row);
          if (searchFeedbackBoost !== 0) {
            score += searchFeedbackBoost;
          }
        }
      }
      const intentRes = applyIntentAxisScoresWithSignals(
        intentAxisFlags,
        classifyCategory(place),
        score
      );
      score = intentRes.score;
      const aiScoreSignals = { ...intentRes.signals };
      if (overlapBoost > 0) {
        aiScoreSignals.overlap_boost = overlapBoost;
      }
      if (searchFeedbackBoost !== 0) {
        aiScoreSignals.search_feedback_boost = searchFeedbackBoost;
      }

      const kwRawForMood = String(keyword || "");
      const moodTextBlob = [
        cat,
        String(place.place_name || ""),
        String(place.place_name || place.title || ""),
        reasonEvidence.summary,
        ...(reasonEvidence.atmosphere || []),
        ...(reasonEvidence.menu || []).slice(0, 4),
        ...(reasonEvidence.curatorLines || []).slice(0, 4),
        ...(reasonEvidence.tags || []).slice(0, 8),
      ]
        .join(" ")
        .toLowerCase();
      if (
        (/조용/.test(kwRawForMood) || /대화/.test(kwRawForMood)) &&
        /조용|차분|대화|아늑/.test(moodTextBlob)
      ) {
        score += 12;
        aiScoreSignals.quiet_mood = 12;
      }

      if (
        blindDateSecondVenueContext &&
        !userAskedBudgetMeal &&
        !userExplicitCafeMealInQuery &&
        misalignedSecondVenueMealCategoryRe.test(cat) &&
        !barLikeReliefRe.test(catLower)
      ) {
        score -= 95;
        aiScoreSignals.date_second_meal_mismatch = -95;
      }

      if (wantsSeafood && isObviousNonSeafoodKakaoPlace(place)) {
        score -= 120;
      }

      if (wantsYajang) {
        const textHit = YAJANG_PLACE_HINT_RE.test(cat);
        let curatorHit = placeSignalsYajangCuratorMeta(place);
        if (!curatorHit && catalogHit) {
          curatorHit = placeSignalsYajangCuratorMeta(catalogHit);
        }
        if (textHit) score += 34;
        if (curatorHit) score += 30;
        if (!textHit && !curatorHit) score -= 26;
      }

      if (wantsDayDrink) {
        let dayDrinkHit = placeSignalsDayDrinkCuratorMeta(place);
        if (!dayDrinkHit && catalogHit) {
          dayDrinkHit = placeSignalsDayDrinkCuratorMeta(catalogHit);
        }
        if (dayDrinkHit) score += 32;
      }

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

      if (party != null && party >= 3) {
        if (/포장마차|포차|실내포장마차|단체|대형|홀/i.test(cat)) score += 12;
        else if (/회식/i.test(cat) && !wantsSeafood) score += 12;
        if (party >= 5) score += 5;
      }
      if (party === 2 && (kwSc.includes("데이트") || barHit)) {
        if (/바|와인|라운지|펍/i.test(cat)) score += 8;
      }

      score += blogInsightBoost(place);

      const socMap = _scoreOpts?.socialBoostByStableKey;
      if (socMap && typeof socMap === "object") {
        const sk = mapPlaceStableDedupeKey(place);
        const soc = sk ? socMap[sk] : null;
        if (
          soc &&
          (Number(soc.pickW) > 0 || Number(soc.hanjan) > 0)
        ) {
          const strongPenaltyGate =
            score <= -52 ||
            (typeof aiScoreSignals.date_second_meal_mismatch === "number" &&
              aiScoreSignals.date_second_meal_mismatch <= -40);
          if (!strongPenaltyGate) {
            const add = dampedSearchSocialScoreDelta(
              soc.pickW,
              soc.hanjan
            );
            if (add > 0) {
              score += add;
              aiScoreSignals.social_boost = add;
            }
          }
        }
      }

      const atmosphere = getAtmosphereFromCategory(place.category_name);
      const sourceKakaoId = place.id;

      const distM = metersForSort(place);
      const facetWhyLine = buildRecommendationWhyLine(place, parsedFacets);
      const signalWhy = buildReasonFromSignals(aiScoreSignals, placeForReason);
      const hasPositiveScoreSignal = Object.values(aiScoreSignals).some(
        (v) => Number(v) > 0
      );
      const whyRecommended =
        hasPositiveScoreSignal && signalWhy !== INTENT_SIGNAL_REASON_FALLBACK
          ? signalWhy
          : facetWhyLine;

      return {
        ...place,
        reasonEvidence,
        distance:
          typeof place.distance === "number" &&
          Number.isFinite(place.distance) &&
          place.distance > 0
            ? place.distance
            : distM < Number.POSITIVE_INFINITY
              ? Math.round(distM)
              : place.distance,
        aiScore: Math.round(score),
        aiScoreSignals,
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
  /** 탭 새로고침마다 바뀌는 값 — 큐레이터 스트립 첫 후보 로테이션·동순위 섞기 */
  const curatorSpotlightSaltRef = useRef(
    (typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(1))[0]
      : Math.floor(Math.random() * 0xffffffff)) >>> 0,
  );
  /** 맞춤 결과 바텀시트 「새로고침」— 재검색 후에도 시트를 다시 펼침 */
  const forceReopenAiSheetAfterSearchRef = useRef(false);

  /** attachCuratorsToCuratorPlaceRows 용 Supabase 원본 행 */
  const curatorAttachRowsRef = useRef([]);
  const mapViewportLoadSeqRef = useRef(0);
  /** `/api/places-in-bounds` 동시 요청 수 — stale 완료만으로 로딩이 영구 true 되는 것 방지 */
  const mapViewportFetchInFlightRef = useRef(0);
  /** bbox+limit별 네트워크 응답 캐시(병합·attach는 매번 최신 스냅으로 수행) */
  const mapViewportFetchCacheRef = useRef({});
  const lastMapBoundsRef = useRef(null);
  const lastMapLevelRef = useRef(null);
  /** 빠른 칩 등: 1차·2차 들어가도 코스 파이프라인 말고 일반 검색일 때 카드 미리보기 허용 */
  const homeSearchSkipCoursePreviewRef = useRef(false);
  const placeDetailRequestSeqRef = useRef(0);
  /** `loadDbPlacesForViewport`가 선언되기 전에도 읽을 수 있게 — 술 상황 칩 ON 시 bbox 확대 */
  const situationFolderFilterRef = useRef(null);

  const [query, setQuery] = useState("");
  const [searchTargetMode, setSearchTargetMode] = useState("place");
  const [mapViewportDbLoading, setMapViewportDbLoading] = useState(false);
  /** placeholder KST 구간 갱신(분 단위) */
  const searchPlaceholderTick = useMinuteTick();
  /** 앱 켜둔 상태에서 운영 모드 자동 전환(분 단위 체크) */
  const now = useTickingNow();

  const homeDustIntroDoneRef = useRef(false);
  const [homeDustIntroDismissed, setHomeDustIntroDismissed] = useState(() => {
    try {
      if (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ) {
        return true;
      }
      return sessionStorage.getItem(HOME_CENTER_DUST_INTRO_KEY) === "1";
    } catch {
      return true;
    }
  });

  const finishHomeDustIntro = useCallback(() => {
    if (homeDustIntroDoneRef.current) return;
    homeDustIntroDoneRef.current = true;
    setHomeDustIntroDismissed(true);
    try {
      sessionStorage.setItem(HOME_CENTER_DUST_INTRO_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const handleHomeDustIntroAnimationEnd = useCallback(
    (e) => {
      /** 일부 브라우저는 animationName 이 비어 있을 수 있음 — 이 노드엔 이 애니 하나만 */
      if (
        e.animationName &&
        e.animationName !== "homeDustIntroCycle"
      ) {
        return;
      }
      finishHomeDustIntro();
    },
    [finishHomeDustIntro]
  );

  const homeSearchInputRef = useRef(null);

  /** 인트로 질문에 답하도록 검색창 포커스 (동네·1차 시작 입력) */
  const handleHomeDustIntroTapToAnswer = useCallback(() => {
    finishHomeDustIntro();
    setSearchTargetMode("place");
    window.requestAnimationFrame(() => {
      try {
        homeSearchInputRef.current?.focus?.();
      } catch {
        // ignore
      }
    });
  }, [finishHomeDustIntro]);

  /** 검색어가 있을 땐 뷰포트마다 DB 전량 갱신하지 않음(검색·카카오 쪽 우선). */
  const loadDbPlacesForViewport = useCallback(
    async ({ boundsRaw, mapLevel }) => {
      if (authLoading) return;
      if (String(query || "").trim()) return;

      const seq = ++mapViewportLoadSeqRef.current;
      const snap = curatorAttachRowsRef.current || [];

      const widenForSituation = Boolean(situationFolderFilterRef.current);
      const padRatio = widenForSituation ? 0.24 : 0.12;
      const padded = padLatLngBounds(boundsRaw.sw, boundsRaw.ne, padRatio);
      if (!padded) {
        setMapViewportDbLoading(false);
        return;
      }

      const south = padded.sw.lat;
      const west = padded.sw.lng;
      const north = padded.ne.lat;
      const east = padded.ne.lng;

      const level =
        typeof mapLevel === "number" && Number.isFinite(mapLevel)
          ? mapLevel
          : typeof lastMapLevelRef.current === "number" &&
              Number.isFinite(lastMapLevelRef.current)
            ? lastMapLevelRef.current
            : 6;
      const hasCuratorChipFilter =
        Array.isArray(selectedCuratorsRef.current) &&
        selectedCuratorsRef.current.length > 0;
      const baseLimit = getLimitByZoom(level);
      const curatorCapByZoom =
        level >= 8 ? 180 : level >= 6 ? 220 : 300;
      const limit = Math.min(
        hasCuratorChipFilter ? curatorCapByZoom : 120,
        Math.round(
          baseLimit *
            (hasCuratorChipFilter ? 2.4 : widenForSituation ? 1.9 : 1)
        )
      );

      /** 뷰포트 캐시 버킷 — 6자리면 미세 팬마다 키가 갈라져 캐시가 거의 안 먹음, 4자리가 무난한 타협 */
      const r4 = (n) => Number(n).toFixed(4);
      const cacheKey = `${r4(south)}_${r4(west)}_${r4(north)}_${r4(east)}_${limit}_${hasCuratorChipFilter ? "cur" : widenForSituation ? "sit" : "all"}`;

      let plainRows;
      let joinResult;

      const cached = mapViewportFetchCacheRef.current[cacheKey];
      if (cached) {
        plainRows = cached.plainRows;
        joinResult = { rows: cached.joinRows, error: null };
      } else {
        mapViewportFetchInFlightRef.current += 1;
        setMapViewportDbLoading(true);
        try {
          const bundle = await fetchMapPlacesInBounds(
            { south, west, north, east, limit },
            AI_API_BASE,
          );
          if (seq !== mapViewportLoadSeqRef.current) return;

          plainRows = bundle.places;
          joinResult = { rows: bundle.joinRows, error: null };

          if (!joinResult.error) {
            mapViewportFetchCacheRef.current[cacheKey] = {
              plainRows: [...(plainRows || [])],
              joinRows: [...(joinResult.rows || [])],
            };
          }
        } catch (e) {
          console.error("❌ 뷰포트 추천 로드 실패:", e);
          return;
        } finally {
          mapViewportFetchInFlightRef.current = Math.max(
            0,
            mapViewportFetchInFlightRef.current - 1,
          );
          if (mapViewportFetchInFlightRef.current === 0) {
            setMapViewportDbLoading(false);
          }
        }
      }

      if (seq !== mapViewportLoadSeqRef.current) return;

      if (joinResult.error) {
        console.error("❌ 뷰포트 추천 로드 오류:", joinResult.error);
        setDbPlaces(formatBoundsPlaceRowsForMap(plainRows || []));
        if (import.meta.env.DEV) {
          console.log(
            "📦 bounds fetch 결과:",
            (plainRows || []).length,
            "(join 오류·places만)"
          );
        }
        if (mapViewportFetchInFlightRef.current === 0) {
          setMapViewportDbLoading(false);
        }
        return;
      }

      const filtered = filterJoinRowsToBounds(joinResult.rows || [], padded);
      const attached = attachCuratorsToCuratorPlaceRows(filtered, snap);
      const fromJoin = buildFormattedPlacesFromJoin(attached);
      const joinIdSet = new Set(fromJoin.map((p) => String(p.id)));
      const extraPlain = (plainRows || []).filter(
        (r) => r?.id != null && !joinIdSet.has(String(r.id))
      );
      const merged = [
        ...fromJoin,
        ...formatBoundsPlaceRowsForMap(extraPlain),
      ];
      setDbPlaces(merged);

      if (import.meta.env.DEV) {
        console.log("📦 bounds fetch 결과:", merged.length, {
          큐레이터연결: fromJoin.length,
          places만: extraPlain.length,
          캐시: Boolean(cached),
          level,
          limit,
        });
      }
      if (mapViewportFetchInFlightRef.current === 0) {
        setMapViewportDbLoading(false);
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
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mutualSearchPanelOpen, setMutualSearchPanelOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  const searchSessionIdRef = useRef(null);
  /** 직전 검색 제출 스냅샷 — 장소 클릭 시 CTR 버킷(`searchClickPath`) 연결 */
  const lastSearchSubmitTelemetryRef = useRef(null);
  /** 직전 `search_logs` 행 — `place_click_logs.search_log_id` */
  const lastSearchLogIdRef = useRef(null);
  /** 직전 검색 제출 쿼리 문자열(클릭 로그용) */
  const lastSearchSubmitQueryRef = useRef("");
  /** 직전 검색의 feedback RPC 컨텍스트(normalized_query, area, intent_tags) */
  const searchFeedbackContextRef = useRef(null);
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
  const [aiSheetPhotoByKey, setAiSheetPhotoByKey] = useState({});
  const [aiSheetExpandedReasonByKey, setAiSheetExpandedReasonByKey] = useState(
    {}
  );
  const [aiReasons, setAiReasons] = useState([]);
  const [aiRecommendedIds, setAiRecommendedIds] = useState([]);
  /** 비-basic AI 검색: 추천 id·리스트·지도를 DB/내부와 섞지 않고 상위만 */
  const aiRecommendExclusiveRef = useRef(false);
  /** `/recommend` 성공 시 카카오 후보를 import 순으로 재정렬하기 위한 직전 점수 리스트 */
  const lastAiScoredPlacesForImportReorderRef = useRef(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [aiSheetPage, setAiSheetPage] = useState(0);
  /** 단순 위치+메뉴 검색: 맞춤 피크바·자동 시트 없이 지도 마커만 */
  const [simpleMapSearchMarkersOnly, setSimpleMapSearchMarkersOnly] =
    useState(false);
  const loadingDots = useAiSearchLoadingDots(isAiSearching);
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
  /** 홈 상단 술 상황 칩 — system_folders.key 와 연결 */
  const [situationFolderFilter, setSituationFolderFilter] = useState(null);
  situationFolderFilterRef.current = situationFolderFilter;

  const [searchIdleHintVisible, setSearchIdleHintVisible] = useState(false);
  const [searchIdleHintText, setSearchIdleHintText] = useState("");
  const searchIdleHintAutoHideRef = useRef(null);

  const homeSearchPlaceholderText = useMemo(
    () =>
      searchTargetMode === "user"
        ? "@유저 핸들을 검색해 보세요"
        : getHomeSearchPlaceholderKst("auto"),
    /** searchPlaceholderTick은 시간 흐름에 따른 강제 재계산용. KST에 따라 placeholder가 바뀜 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchPlaceholderTick, searchTargetMode]
  );
  const judoMode = useMemo(() => getJudoOperationMode(now), [now]);
  const judoCopy = useMemo(() => getJudoModeCopy(judoMode), [judoMode]);
  const dayModeRemainingClock = useMemo(() => {
    if (!judoMode.isDayMode) return "";
    const target = new Date(now);
    target.setHours(16, 0, 0, 0);
    const diffMs = Math.max(0, target.getTime() - now.getTime());
    const totalSec = Math.floor(diffMs / 1000);
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, [judoMode.isDayMode, now]);
  const dayModeNoticeText = useMemo(() => {
    if (!judoMode.isDayMode) return "";
    return `${judoCopy.sub} (${dayModeRemainingClock})`;
  }, [judoCopy.sub, judoMode.isDayMode, dayModeRemainingClock]);

  const dismissSearchIdleHint = useCallback(() => {
    setSearchIdleHintVisible(false);
    if (searchIdleHintAutoHideRef.current != null) {
      window.clearTimeout(searchIdleHintAutoHideRef.current);
      searchIdleHintAutoHideRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /** 비입력 ~2.6초 후 보조 힌트(세션 최대 2회) — 검색바가 주, 이건 보조 */
  useEffect(() => {
    dismissSearchIdleHint();
    if (selectedPlace || String(query || "").trim() || isAiSearching) {
      return undefined;
    }
    if (!homeDustIntroDismissed) {
      return undefined;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      return undefined;
    }
    let shownCount = 0;
    try {
      shownCount = parseInt(
        sessionStorage.getItem(HOME_SEARCH_IDLE_HINTS_KEY) || "0",
        10
      );
    } catch {
      shownCount = 0;
    }
    if (shownCount >= 2) {
      return undefined;
    }

    const delayMs = 2600;
    const showTimer = window.setTimeout(() => {
      const idx = Math.min(
        shownCount,
        Math.max(0, SEARCH_IDLE_HINT_MESSAGES.length - 1)
      );
      setSearchIdleHintText(SEARCH_IDLE_HINT_MESSAGES[idx] ?? "");
      try {
        sessionStorage.setItem(
          HOME_SEARCH_IDLE_HINTS_KEY,
          String(shownCount + 1)
        );
      } catch {
        /* ignore */
      }
      setSearchIdleHintVisible(true);
      searchIdleHintAutoHideRef.current = window.setTimeout(() => {
        setSearchIdleHintVisible(false);
        searchIdleHintAutoHideRef.current = null;
      }, 6500);
    }, delayMs);

    return () => {
      window.clearTimeout(showTimer);
      if (searchIdleHintAutoHideRef.current != null) {
        window.clearTimeout(searchIdleHintAutoHideRef.current);
        searchIdleHintAutoHideRef.current = null;
      }
    };
  }, [
    query,
    selectedPlace,
    isAiSearching,
    homeDustIntroDismissed,
    dismissSearchIdleHint,
  ]);

  useEffect(() => {
    if (String(query || "").trim()) {
      setSituationFolderFilter(null);
    }
  }, [query]);

  /** 홈 첫 진입 중앙 인트로 — 검색·카드·AI 검색으로 나가면 세션 완료 처리 */
  useEffect(() => {
    if (homeDustIntroDismissed) return;
    const idle =
      !selectedPlace &&
      !String(query || "").trim() &&
      !isAiSearching;
    if (!idle) finishHomeDustIntro();
  }, [
    homeDustIntroDismissed,
    selectedPlace,
    query,
    isAiSearching,
    finishHomeDustIntro,
  ]);

  /** 애니메이션 end 미수신 시에도 인트로 종료(백업) */
  useEffect(() => {
    if (homeDustIntroDismissed) return;
    if (selectedPlace || String(query || "").trim() || isAiSearching) return;
    const t = window.setTimeout(() => finishHomeDustIntro(), 5200);
    return () => window.clearTimeout(t);
  }, [
    homeDustIntroDismissed,
    selectedPlace,
    query,
    isAiSearching,
    finishHomeDustIntro,
  ]);

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
    isLoadingCourse,
    chooseCourse,
    regenerateSelectedCourseSecond,
    regenerateSelectedCourseFirst,
    rerunDifferentCourses,
    applyAlternativeSecond,
    applyAlternativeFirst,
    applyComposedCourseFromSteps,
    applyMapPickAsFirstStepAsync,
    computeSecondStepCandidatesOnly,
    applySecondStepPick,
    courseQueryParsed,
  } = useCourseSearch();

  const {
    recommendation: curatorImportRecommendation,
    setRecommendation: setCuratorImportRecommendation,
    loading: recommendFetchLoading,
    error: recommendFetchError,
    fetchRecommend: fetchCuratorImportRecommend,
  } = useRecommendation();

  /** `/recommend` — DB에 확정 저장된 `places`보다 `raw_data` 파싱 `import_pool`이 있으면 우선 */
  const curatorImportPlacesOrPool = useMemo(() => {
    const r = curatorImportRecommendation;
    if (!r?.ok) return [];
    if (Array.isArray(r.import_pool) && r.import_pool.length > 0) {
      return r.import_pool;
    }
    return Array.isArray(r.places) ? r.places : [];
  }, [curatorImportRecommendation]);

  const {
    selectedRecommendedPlace,
    matchedMapPlace,
    openRecommendedPlace,
    closeRecommendedPlaceDetail,
  } = useSelectedRecommendedPlace();

  const mergedRecommendDetailPlace = useMemo(
    () => ({
      ...(matchedMapPlace && typeof matchedMapPlace === "object"
        ? matchedMapPlace
        : {}),
      ...(selectedRecommendedPlace &&
      typeof selectedRecommendedPlace === "object"
        ? selectedRecommendedPlace
        : {}),
    }),
    [matchedMapPlace, selectedRecommendedPlace]
  );

  const recommendDetailIsSaved = useMemo(() => {
    if (!selectedRecommendedPlace && !matchedMapPlace) return false;
    const savedKeySet = buildMergedSavedPlaceKeySet(savedMap, userSavedPlaces);
    return placeMatchesSavedKeySet(mergedRecommendDetailPlace, savedKeySet);
  }, [
    selectedRecommendedPlace,
    matchedMapPlace,
    mergedRecommendDetailPlace,
    savedMap,
    userSavedPlaces,
  ]);

  /** 코스 세션과 `/recommend`·import 오버레이가 겹치면 단일 가게·미리보기가 뜨는 문제 방지 */
  const clearImportRecommendationOverlay = useCallback(() => {
    closeRecommendedPlaceDetail();
    setCuratorImportRecommendation(null);
  }, [closeRecommendedPlaceDetail, setCuratorImportRecommendation]);

  const [courseMapOverlay, setCourseMapOverlay] = useState(null);
  /** OSRM 기반 — 길·도보가 길 때 카드에만 표시(지도 커스텀오버레이는 가독성 낮음) */
  const [courseWalkStrollHint, setCourseWalkStrollHint] = useState("");
  /** 미리보기 「도착 길찾기」: 내 위치 → 선택 장소 (지도 주황 폴리라인) */
  const [arrivalWalkingOverlay, setArrivalWalkingOverlay] = useState(null);
  const arrivalWalkReqIdRef = useRef(0);
  /** 미리보기 닫혀도 유지 — 다른 장소 미리보기로 바뀔 때만 도착 경로 초기화용 */
  const lastPreviewPlaceRouteKeyRef = useRef("");
  /** 지역명만 검색 시 OSM 기반 행정구역 경계(맵 Polygon) */
  const [regionBoundaryOverlay, setRegionBoundaryOverlay] = useState(null);
  /**
   * 검색 제출 후 `mapDisplayedPlacesWithLegend`가 커밋된 뒤, 실제 지도에 올라간 마커 좌표로
   * `fitToPlaces`를 한 번 더 호출하기 위한 틱(스케줄만 맞추면 마커와 뷰가 어긋나는 문제 완화).
   */
  const [mapSearchMarkerFitTick, setMapSearchMarkerFitTick] = useState(0);
  const lastHandledMapSearchFitTickRef = useRef(0);
  /** 술 상황 칩: 카카오·통합 결과로 `places-auto-fit`/`fitToPlaces`가 줌아웃하지 않도록 */
  const [preserveMapViewportSituationChip, setPreserveMapViewportSituationChip] =
    useState(false);
  /** 칩 세션 동안 `searchMapBars`에 항상 현재 지도 bounds 사용(키워드에 `구`/`로` 있어도 전국 검색 안 함) */
  const situationChipMapSearchViewportRef = useRef(false);
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
  /** 코스 카드에서 스텝 단위로 담는 조합 — 1차 칸 비면 거기, 차면 2차 칸(원래 코스의 몇 차인지 무관) */
  const [courseComposeSlotFirst, setCourseComposeSlotFirst] =
    useState(null);
  /** 쩜오차(1차·2차 사이) — `courseIncludeHalfStep`일 때만 사용 */
  const [courseComposeSlotBridge, setCourseComposeSlotBridge] =
    useState(null);
  const [courseComposeSlotSecond, setCourseComposeSlotSecond] =
    useState(null);
  /** 내 위치 GPS로 연 코스 검색 시 좌표 보관(반경 5·8km 재검색) */
  const courseGpsUserOriginRef = useRef(null);
  /** 마지막 코스 검색에 쓴 loadOpts — 쩜오차 토글 시 동일 반경·GPS로 재검색 */
  const courseLastLoadOptsRef = useRef(null);
  /** 1차·2차 사이 쩜오차(카페·디저트) 구간 포함 */
  const [courseIncludeHalfStep, setCourseIncludeHalfStep] = useState(false);
  const [courseGpsRadiusM, setCourseGpsRadiusM] = useState(
    COURSE_GPS_DEFAULT_RADIUS_M
  );
  const [courseSearchUsedGpsOrigin, setCourseSearchUsedGpsOrigin] =
    useState(false);

  const clearCourseSecondPickPulse = useCallback(() => {
    setCourseSecondPickMode(false);
    lastSecondCandidatesRef.current = [];
    setCourseSecondPulseMapPlaces([]);
  }, []);

  /**
   * 첫 칸 비면 1차, 다음은 쩜오 토글 시 쩜오차·2차 순. 같은 가게 다시 누르면 해당 칸에서 뺌.
   * 세 칸 다 찼을 때 새 담기는 2차(마지막)만 갱신.
   */
  const assignCourseStepToComposeAuto = useCallback(
    (step) => {
      if (!step?.place) return;
      const clone = { ...step, place: step.place };
      const pid = placeId(step.place);
      const fp = placeId(courseComposeSlotFirst?.place);
      const bp = placeId(courseComposeSlotBridge?.place);
      const sp = placeId(courseComposeSlotSecond?.place);

      if (pid != null && pid === fp) {
        setCourseComposeSlotFirst(null);
        return;
      }
      if (courseIncludeHalfStep && pid != null && pid === bp) {
        setCourseComposeSlotBridge(null);
        return;
      }
      if (pid != null && pid === sp) {
        setCourseComposeSlotSecond(null);
        return;
      }

      if (!courseComposeSlotFirst?.place) {
        setCourseComposeSlotFirst(clone);
        return;
      }
      if (courseIncludeHalfStep) {
        if (!courseComposeSlotBridge?.place) {
          setCourseComposeSlotBridge(clone);
          return;
        }
        if (!courseComposeSlotSecond?.place) {
          setCourseComposeSlotSecond(clone);
          return;
        }
        setCourseComposeSlotSecond(clone);
        return;
      }
      if (!courseComposeSlotSecond?.place) {
        setCourseComposeSlotSecond(clone);
        return;
      }
      setCourseComposeSlotSecond(clone);
    },
    [
      courseIncludeHalfStep,
      courseComposeSlotFirst,
      courseComposeSlotBridge,
      courseComposeSlotSecond,
    ]
  );

  useEffect(() => {
    if (!isCourseMode) {
      setCourseComposeSlotFirst(null);
      setCourseComposeSlotBridge(null);
      setCourseComposeSlotSecond(null);
      clearCourseSecondPickPulse();
      setCourseSecondFindModalOpen(false);
      setCourseIncludeHalfStep(false);
      courseLastLoadOptsRef.current = null;
      setCourseWalkStrollHint("");
    }
  }, [isCourseMode, clearCourseSecondPickPulse]);

  /** 조합 미리보기: 쩜오 토글 시 1·쩜오·2 세 칸, 아니면 1·2만 지도에 반영 */
  const composePreviewCourse = useMemo(() => {
    const a = courseComposeSlotFirst;
    const b = courseComposeSlotSecond;
    const mid = courseIncludeHalfStep ? courseComposeSlotBridge : null;
    if (!a && !b && !mid) return null;

    const legMeters = (p0, p1) => {
      const w0 = resolvePlaceWgs84(p0);
      const w1 = resolvePlaceWgs84(p1);
      if (!w0 || !w1) return NaN;
      return haversineMeters(w0.lat, w0.lng, w1.lat, w1.lng);
    };

    if (a?.place && mid?.place && b?.place) {
      const d01 = legMeters(a.place, mid.place);
      const d12 = legMeters(mid.place, b.place);
      return {
        key: "__compose_preview__",
        steps: [
          { ...a, step: 1, label: "1차", place: a.place },
          {
            ...mid,
            step: 2,
            label: "쩜오차",
            place: mid.place,
            stayMinutes: Number.isFinite(Number(mid.stayMinutes))
              ? Number(mid.stayMinutes)
              : 25,
            walkDistanceMeters: Number.isFinite(d01)
              ? Math.round(d01)
              : mid.walkDistanceMeters,
          },
          {
            ...b,
            step: 3,
            label: "2차",
            place: b.place,
            walkDistanceMeters: Number.isFinite(d12)
              ? Math.round(d12)
              : b.walkDistanceMeters,
          },
        ],
      };
    }

    if (a?.place && mid?.place) {
      const d01 = legMeters(a.place, mid.place);
      return {
        key: "__compose_preview__",
        steps: [
          { ...a, step: 1, label: a.label ?? "1차", place: a.place },
          {
            ...mid,
            step: 2,
            label: mid.label ?? "쩜오차",
            place: mid.place,
            stayMinutes: Number.isFinite(Number(mid.stayMinutes))
              ? Number(mid.stayMinutes)
              : 25,
            walkDistanceMeters: Number.isFinite(d01)
              ? Math.round(d01)
              : mid.walkDistanceMeters,
          },
        ],
      };
    }

    if (mid?.place && b?.place) {
      const d = legMeters(mid.place, b.place);
      return {
        key: "__compose_preview__",
        steps: [
          {
            ...mid,
            step: 2,
            label: mid.label ?? "쩜오차",
            place: mid.place,
          },
          {
            ...b,
            step: 3,
            label: b.label ?? "2차",
            place: b.place,
            walkDistanceMeters: Number.isFinite(d)
              ? Math.round(d)
              : b.walkDistanceMeters,
          },
        ],
      };
    }

    if (a?.place && b?.place) {
      const w0 = resolvePlaceWgs84(a.place);
      const w1 = resolvePlaceWgs84(b.place);
      const d =
        w0 && w1
          ? haversineMeters(w0.lat, w0.lng, w1.lat, w1.lng)
          : NaN;
      return {
        key: "__compose_preview__",
        steps: [
          { ...a, step: 1, label: a.label ?? "1차", place: a.place },
          {
            ...b,
            step: 2,
            label: b.label ?? "2차",
            place: b.place,
            walkDistanceMeters: Number.isFinite(d)
              ? Math.round(d)
              : b.walkDistanceMeters,
          },
        ],
      };
    }
    if (a?.place) {
      return {
        key: "__compose_preview__",
        steps: [{ ...a, step: 1, label: a.label ?? "1차", place: a.place }],
      };
    }
    if (b?.place) {
      return {
        key: "__compose_preview__",
        steps: [{ ...b, step: 2, label: b.label ?? "2차", place: b.place }],
      };
    }
    if (mid?.place) {
      return {
        key: "__compose_preview__",
        steps: [
          {
            ...mid,
            step: 2,
            label: mid.label ?? "쩜오차",
            place: mid.place,
          },
        ],
      };
    }
    return null;
  }, [
    courseComposeSlotFirst,
    courseComposeSlotBridge,
    courseComposeSlotSecond,
    courseIncludeHalfStep,
  ]);

  const courseDrivingMap = composePreviewCourse ?? selectedCourse;
  const canAddHalfStepNow = Boolean(
    isCourseMode &&
      courseDrivingMap &&
      Array.isArray(courseDrivingMap.steps) &&
      courseDrivingMap.steps.length === 2 &&
      !courseIncludeHalfStep
  );

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

  /** 코스/도보 경로·2차 UI가 지도에 있을 때 — 술 상황 칩(z~88)이 폴리라인보다 위에 깔려 경로를 가리는 것 방지 */
  const hideSituationFolderStripForMapCourseUi = useMemo(
    () =>
      Boolean(courseMapOverlay) ||
      Boolean(arrivalWalkingOverlay) ||
      courseSecondPickMode ||
      courseSecondFindModalOpen,
    [
      courseMapOverlay,
      arrivalWalkingOverlay,
      courseSecondPickMode,
      courseSecondFindModalOpen,
    ]
  );

  /** 일반 검색 마커 setBounds — 헤더·하단 검색바에 가리지 않게 */
  const mapSearchPlacesFitPadding = useMemo(() => {
    if (isCourseMode || !String(query || "").trim()) return null;
    return {
      top: 88,
      right: 18,
      bottom: searchMapBottomChromePx(),
      left: 18,
    };
  }, [isCourseMode, query]);

  /** 코스 카드 가로 스와이프 — 스크롤이 멈춘 뒤에만 선택·지도 반영 (스크롤 중 휙휙 변경 방지) */
  const courseSwipeRowRef = useRef(null);
  /** 직행↔쩜오 등 재로딩 직전 `scrollLeft` — 갱신 후 자동 센터링 대신 복원 */
  const courseSwipePreserveScrollLeftRef = useRef(null);
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

  /** 1차·2차 장소가 모두 잡힌 선택 코스 */
  const courseHasFinalTwoSteps = useMemo(() => {
    const steps = selectedCourse?.steps;
    if (!Array.isArray(steps) || steps.length < 2) return false;
    return Boolean(steps[0]?.place && steps[1]?.place);
  }, [selectedCourse]);

  /** 검색 문장은 두고 코스만 비움 — 경로 오버레이만 닫기 */
  const dismissCourseMapPath = useCallback(() => {
    const k = String(courseDrivingMap?.key ?? "");
    if (k) coursePathDismissedForCourseKeyRef.current = k;
    setCourseMapOverlay(null);
    setCourseWalkStrollHint("");
    /** 경로 × — 2차 후보 펄스·후보 마커도 같이 종료 */
    clearCourseSecondPickPulse();
  }, [courseDrivingMap?.key, clearCourseSecondPickPulse]);

  const handleResetCoursePickWithSavePrompt = useCallback(() => {
    const course = selectedCourse;
    if (!course?.steps?.[0]?.place || !course?.steps?.[1]?.place) return;

    const okClear = window.confirm(
      "선택한 코스(1차·2차)를 지울까요?\n검색 문장은 그대로 두고 코스만 비워요."
    );
    if (!okClear) return;

    clearCourseSecondPickPulse();
    resetCourseSearch();
    setSelectedPlace(null);
    setAiSheetOpen(false);
  }, [selectedCourse, clearCourseSecondPickPulse, resetCourseSearch]);

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
    if (!isCourseMode || !aiSheetOpen) {
      return;
    }
    const el = courseSwipeRowRef.current;
    if (!el) return;
    const preserved = courseSwipePreserveScrollLeftRef.current;
    if (preserved != null && Number.isFinite(preserved)) {
      if (!courseOptions?.length || !selectedCourse) {
        courseSwipePreserveScrollLeftRef.current = null;
        return;
      }
      courseSwipePreserveScrollLeftRef.current = null;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollLeft = Math.max(0, Math.min(Math.round(preserved), maxScroll));
      return;
    }
    if (!courseOptions?.length || !selectedCourse) {
      return;
    }
    const idx = courseOptions.findIndex((c) => c.key === selectedCourse.key);
    if (idx < 0) return;
    const child = el.children[idx];
    if (!(child instanceof HTMLElement)) return;
    const host = el.getBoundingClientRect();
    const cr = child.getBoundingClientRect();
    const pad = 12;
    const needs = cr.left < host.left + pad || cr.right > host.right - pad;
    if (needs) {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const targetLeft = Math.round(
        child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2
      );
      el.scrollLeft = Math.max(0, Math.min(targetLeft, maxScroll));
    }
    /** key 변화에만 반응 — selectedCourse 객체 reference 갱신만으로 스크롤 재정렬 트리거 X */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCourseMode, aiSheetOpen, selectedCourse?.key, courseOptions]);

  useEffect(() => {
    let cancelled = false;
    setCourseWalkStrollHint("");
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

    const steps = courseDrivingMap?.steps || [];
    const wgsThree =
      Array.isArray(steps) && steps.length >= 3
        ? [
            resolvePlaceWgs84(steps[0]?.place),
            resolvePlaceWgs84(steps[1]?.place),
            resolvePlaceWgs84(steps[2]?.place),
          ]
        : null;
    const useChainedRoute = Boolean(
      wgsThree?.[0] && wgsThree[1] && wgsThree[2]
    );

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

    const straightM = getCourseLegMeters(courseDrivingMap);
    const fallbackStraight = () => {
      if (skipDismissed()) return;
      setCourseWalkStrollHint("");
      setCourseMapOverlay({
        polylinePath: base.polylinePath,
        legLabel: base.legLabel,
        labelPosition: base.labelPosition,
        key: `${myKey}-straight`,
      });
    };

    const applyWalkingRouteToOverlay = (route, labelPosition) => {
      if (cancelled || skipDismissed()) return;
      if (route?.ok && Array.isArray(route.path) && route.path.length >= 2) {
        const dm = Number(route.distanceMeters) || 0;
        const ds = Number(route.durationSeconds) || 0;
        const reasonable = isWalkingRouteReasonable({
          routedMeters: dm,
          straightMeters: straightM,
          durationSeconds: ds,
        });
        let legLabel;
        let strollHint = "";
        if (reasonable && dm > 0) {
          const walkMin = walkingRouteDisplayMinutes(dm, ds);
          const distStr =
            dm >= 1000 ? `약 ${(dm / 1000).toFixed(1)}km` : `약 ${Math.round(dm)}m`;
          legLabel = `길 따라 ${distStr} · 도보 약 ${walkMin}분`;
          strollHint = getCourseLongWalkStrollHint({
            routedMeters: dm,
            straightMeters: straightM,
            walkDisplayMinutes: walkMin,
          });
        } else if (dm > 0) {
          const walkMin = walkingRouteDisplayMinutes(dm, ds);
          const distStr =
            dm >= 1000 ? `약 ${(dm / 1000).toFixed(1)}km` : `약 ${Math.round(dm)}m`;
          legLabel = `보행 경로 ${distStr} · 도보 약 ${walkMin}분`;
          strollHint = getCourseLongWalkStrollHint({
            routedMeters: dm,
            straightMeters: straightM,
            walkDisplayMinutes: walkMin,
          });
        } else {
          legLabel = base.legLabel;
        }
        setCourseWalkStrollHint(strollHint || "");
        let lp = labelPosition;
        if (
          !lp ||
          !Number.isFinite(Number(lp.lat)) ||
          !Number.isFinite(Number(lp.lng))
        ) {
          const mid = route.path[Math.floor(route.path.length / 2)];
          lp = { lat: Number(mid.lat), lng: Number(mid.lng) };
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
    };

    if (useChainedRoute) {
      fetchChainedCourseWalkingRoutes(wgsThree).then((route) => {
        if (cancelled || skipDismissed()) return;
        const cafeMid = {
          lat: Number(wgsThree[1].lat),
          lng: Number(wgsThree[1].lng),
        };
        applyWalkingRouteToOverlay(route, cafeMid);
      });
    } else {
      fetchCourseWalkingRoute(a.lat, a.lng, b.lat, b.lng).then((route) => {
        if (cancelled || skipDismissed()) return;
        const mid = route?.path?.[Math.floor((route.path?.length ?? 0) / 2)];
        const lp = mid
          ? { lat: Number(mid.lat), lng: Number(mid.lng) }
          : null;
        applyWalkingRouteToOverlay(route, lp);
      });
    }

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

  /**
   * 로그인 전에도 첫 입장 시 1회 브라우저 위치 권한·좌표 확보(주변 검색·코스 기준점 보조).
   * 같은 탭에서 중복 프롬프트 방지 — React Strict 이중 effect 겸용.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    try {
      if (window.sessionStorage.getItem("judo_entry_geo_attempted") === "1") {
        return;
      }
      window.sessionStorage.setItem("judo_entry_geo_attempted", "1");
    } catch {
      /* 비저장 모드 등 — 아래에서 그대로 1회 시도 */
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setCurrentLocation((prev) =>
          prev &&
          Number.isFinite(prev.lat) &&
          Number.isFinite(prev.lng)
            ? prev
            : { lat, lng }
        );
      },
      () => {
        /* 거부·타임아웃 — 알림 없이 (로그인 전 입장 플로우) */
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 120000,
      }
    );
  }, []);

  const handleCourseGpsRadiusChange = useCallback(
    async (meters) => {
      const q = String(query || "").trim();
      if (!q || !isCourseQuery(q)) return;
      const origin = courseGpsUserOriginRef.current;
      if (
        !origin ||
        !Number.isFinite(Number(origin.lat)) ||
        !Number.isFinite(Number(origin.lng))
      ) {
        showToast("내 위치를 먼저 받은 뒤 반경을 바꿀 수 있어요.", "info", 2800);
        return;
      }
      setCourseGpsRadiusM(meters);
      const sheetOpenBefore = aiSheetOpen;
      const swipeRow = courseSwipeRowRef.current;
      courseSwipePreserveScrollLeftRef.current =
        swipeRow && Number.isFinite(swipeRow.scrollLeft)
          ? swipeRow.scrollLeft
          : null;
      /** `isAiSearching` 켜면 코스 시트가 통째로 사라져 레이아웃이 밀림 — `useCourseSearch`의 `isLoadingCourse`만 사용 */
      try {
        clearImportRecommendationOverlay();
        const res = await runCourseSearch(q, {
          userOrigin: origin,
          maxDistanceMeters: meters,
          strictNearbyOnly: true,
          includeHalfStep: courseIncludeHalfStep,
          preserveSelectionFromCourse: selectedCourse,
          keepExistingOptionsUntilLoaded: true,
        });
        if (!res.handled) {
          courseSwipePreserveScrollLeftRef.current = null;
        }
        if (res.handled) {
          if (sheetOpenBefore) setAiSheetOpen(true);
          const n = res.options?.[0]?.steps?.length ?? 0;
          setAiSummary(
            res.options?.length
              ? n >= 3
                ? `내 위치 기준 ${Math.round(meters / 1000)}km 안에서 짠 3단계(쩜오차 포함) 코스예요.`
                : `내 위치 기준 ${Math.round(meters / 1000)}km 안에서 짠 2단계 코스예요.`
              : ""
          );
        }
      } catch (e) {
        courseSwipePreserveScrollLeftRef.current = null;
        console.warn("course radius change:", e);
      }
    },
    [
      query,
      runCourseSearch,
      showToast,
      courseIncludeHalfStep,
      clearImportRecommendationOverlay,
      selectedCourse,
      aiSheetOpen,
    ]
  );

  const handleCourseIncludeHalfStepChange = useCallback(
    async (next) => {
      if (courseIncludeHalfStep === next) return;
      const previousSelection = selectedCourse;
      const sheetOpenBefore = aiSheetOpen;
      setCourseIncludeHalfStep(next);
      setCourseComposeSlotFirst(null);
      setCourseComposeSlotBridge(null);
      setCourseComposeSlotSecond(null);
      const q = String(query || "").trim();
      // 지도에서 2차를 먼저 고른 뒤(일반 검색어 상태)도 현재 코스를 기준으로 즉시 쩜오 재계산.
      const searchQueryForRerun = isCourseQuery(q) ? q : "코스 짜기";
      /** `isAiSearching` 켜면 코스 카드·시트가 언마운트되어 화면이 밀림 — 훅의 `isLoadingCourse`로만 대기 표시 */
      try {
        clearImportRecommendationOverlay();
        const swipeRow = courseSwipeRowRef.current;
        courseSwipePreserveScrollLeftRef.current =
          swipeRow && Number.isFinite(swipeRow.scrollLeft)
            ? swipeRow.scrollLeft
            : null;
        const base = courseLastLoadOptsRef.current || {};
        const stepsPrev = previousSelection?.steps || [];
        const wFirst = stepsPrev[0]?.place
          ? resolvePlaceWgs84(stepsPrev[0].place)
          : null;
        const wLast =
          stepsPrev.length > 1
            ? resolvePlaceWgs84(
                stepsPrev[stepsPrev.length - 1]?.place
              )
            : null;
        /** 쩜오 토글만으로 `코스 짜기`를 다시 돌리면 앵커가 없어 전국 풀 → 임의 동네 코스가 됨. 현재 1·2차 좌표로 좁힘. */
        let mergedLoad = { ...base };
        if (wFirst) {
          let maxM = Number(mergedLoad.maxDistanceMeters);
          if (!Number.isFinite(maxM) || maxM <= 0) maxM = 4500;
          if (wLast) {
            const leg = haversineMeters(
              wFirst.lat,
              wFirst.lng,
              wLast.lat,
              wLast.lng
            );
            if (Number.isFinite(leg)) {
              maxM = Math.min(12000, Math.max(maxM, Math.ceil(leg) + 2000));
            }
          }
          mergedLoad = {
            ...mergedLoad,
            userOrigin: { lat: wFirst.lat, lng: wFirst.lng },
            maxDistanceMeters: maxM,
            strictNearbyOnly: true,
          };
        }
        const res = await runCourseSearch(searchQueryForRerun, {
          ...mergedLoad,
          includeHalfStep: next,
          preserveSelectionFromCourse: previousSelection,
          keepExistingOptionsUntilLoaded: true,
          halfStepEditMode: next ? "insert" : "strip",
          halfStepBaseCourses: courseOptions,
        });
        if (!res.handled) {
          courseSwipePreserveScrollLeftRef.current = null;
        }
        if (res.handled) {
          if (sheetOpenBefore) setAiSheetOpen(true);
          if (res.parsed) {
            setCourseIncludeHalfStep(Boolean(res.parsed.includeHalfStep));
          }
          courseLastLoadOptsRef.current = {
            ...mergedLoad,
            includeHalfStep: next,
          };
          if (res.options?.length) {
            showToast(
              next
                ? "쩜오차(달달 구간)를 넣은 코스로 다시 짰어요."
                : "1차→2차만 있는 코스로 다시 짰어요.",
              "success",
              2200
            );
          }
        }
      } catch (e) {
        courseSwipePreserveScrollLeftRef.current = null;
        console.warn("course half-step toggle:", e);
        setCourseIncludeHalfStep(() => !next);
        showToast("코스를 다시 짜는 데 실패했어요. 잠시 후 다시 시도해 주세요.", "error", 2800);
      }
    },
    [
      query,
      runCourseSearch,
      showToast,
      courseIncludeHalfStep,
      clearImportRecommendationOverlay,
      selectedCourse,
      aiSheetOpen,
      courseOptions,
    ]
  );

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

  /** 검색어 없을 때: 뷰포트·술 상황 칩 변경 시 DB 후보 재조회(칩 ON이면 bbox 패딩·limit 확대) */
  useEffect(() => {
    if (String(query || "").trim()) return;
    const b = lastMapBoundsRef.current;
    if (b?.sw && b?.ne) {
      scheduleDbPlacesForBounds(b, lastMapLevelRef.current);
    }
  }, [query, situationFolderFilter, scheduleDbPlacesForBounds]);

  useEffect(() => {
    if (!dbCurators.length) return;
    const b = lastMapBoundsRef.current;
    if (b?.sw && b?.ne && !String(query || "").trim()) {
      scheduleDbPlacesForBounds(b, lastMapLevelRef.current);
    }
  }, [dbCurators.length, query, scheduleDbPlacesForBounds]);

  /** 큐레이터 칩 on/off 시점에는 뷰포트 후보 풀을 즉시 다시 불러와 필터 0건 착시를 줄인다. */
  useEffect(() => {
    if (String(query || "").trim()) return;
    const b = lastMapBoundsRef.current;
    if (b?.sw && b?.ne) {
      const hasCuratorChipFilter =
        Array.isArray(selectedCurators) && selectedCurators.length > 0;
      if (hasCuratorChipFilter) {
        /** 칩 클릭 직후는 디바운스 우회해서 즉시 1회 로드(체감 지연 완화) */
        void loadDbPlacesForViewport({
          boundsRaw: b,
          mapLevel: lastMapLevelRef.current,
        });
      } else {
        scheduleDbPlacesForBounds(b, lastMapLevelRef.current);
      }
    }
  }, [
    selectedCurators,
    showSavedOnly,
    query,
    scheduleDbPlacesForBounds,
    loadDbPlacesForViewport,
  ]);

  /** Supabase `places` 행 + 추천(curator_places) — 미리보기 열린 뒤 보강 (UUID 또는 카카오 ID로 DB 매칭) */
  useEffect(() => {
    const place = selectedPlace;
    if (!place) return;

    const seq = ++placeDetailRequestSeqRef.current;
    let cancelled = false;

    (async () => {
      let uuid = null;
      const idStr = place?.id != null ? String(place.id) : "";
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          idStr
        )
      ) {
        uuid = idStr;
      } else {
        const kid = normalizeKakaoPlaceId(place);
        if (!kid) return;
        uuid = await fetchPlaceUuidByKakaoPlaceId(kid);
        if (!uuid) return;
      }

      if (cancelled || seq !== placeDetailRequestSeqRef.current) return;

      try {
        const { place: detail, curatorPlaceRows } = await fetchPlaceDetail(
          uuid,
          AI_API_BASE,
        );
        if (cancelled || seq !== placeDetailRequestSeqRef.current) return;

        const joinRows = (curatorPlaceRows || []).map((cp) => ({
          ...cp,
          places: { ...detail },
        }));
        const attached = attachCuratorsToCuratorPlaceRows(
          joinRows,
          curatorAttachRowsRef.current
        );
        const formatted = buildFormattedPlacesFromJoin(attached);
        const enriched = formatted[0] ?? null;

        setSelectedPlace((prev) => {
          if (!prev) return prev;
          if (cancelled || seq !== placeDetailRequestSeqRef.current) return prev;

          const prevUuid =
            prev?.id != null &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              String(prev.id)
            )
              ? String(prev.id)
              : null;
          const prevKid = normalizeKakaoPlaceId(prev);
          const detailKid = normalizeKakaoPlaceId(detail);

          const sameVenue =
            (prevUuid && prevUuid === uuid) ||
            (prevKid && detailKid && prevKid === detailKid);
          if (!sameVenue) return prev;

          return mergeDbPlaceDetailForPreview(prev, detail, enriched);
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
    /** 같은 venue 내부 필드 변화로는 재요청하지 않음 — id 3종에만 반응 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace?.id, selectedPlace?.place_id, selectedPlace?.kakao_place_id]);

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

  const handleRisingCuratorPick = useCallback(
    (row) => {
      const candidates = [
        row?.curator_id,
        row?.user_id,
        row?.slug,
        row?.username,
        row?.display_name,
        row?.name,
      ]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);
      if (candidates.length === 0) return;
      let selectedToken = "";
      for (const c of candidates) {
        const normalized = canonicalCuratorChipToken(c, dbCurators);
        if (normalized) {
          selectedToken = normalized;
          break;
        }
      }
      if (!selectedToken) {
        /** dbCurators 매칭 실패 시에도 RPC가 준 auth uid(curator_id)로 직접 필터 시도 */
        selectedToken = candidates[0];
      }
      setShowSavedOnly(false);
      setLegendCategory(null);
      setShowAll(false);
      setSelectedCurators([selectedToken]);
    },
    [dbCurators]
  );

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
    (place, clickSource = "map_click", clickMeta = null) => {
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
          const cr = clickMeta?.clickedRank;
          let visible = clickMeta?.userVisibleCandidateCount;
          /* 실보이 수 미전달 시에만: 파이프라인 화면 슬롯 수로 대리(의미는 userVisible ≠ pipeline — 집계 시 라벨 구분) */
          if (
            !(Number.isFinite(visible) && visible >= 0) &&
            sid &&
            lastSearchSubmitTelemetryRef.current &&
            String(lastSearchSubmitTelemetryRef.current.sessionId) ===
              String(sid)
          ) {
            const u =
              lastSearchSubmitTelemetryRef.current.pipelineScreenRowCount;
            if (typeof u === "number" && u >= 0) visible = u;
          }
          const clickPath = deriveSearchClickPath(
            clickSource,
            sid,
            lastSearchSubmitTelemetryRef.current
          );
          const fbCtx = searchFeedbackContextRef.current;
          const normalizedForClickLog =
            (fbCtx?.normalizedQuery && String(fbCtx.normalizedQuery).trim()) ||
            normalizeQueryForFeedback(lastSearchSubmitQueryRef.current || "") ||
            null;
          insertPlaceClickLog({
            sessionId: sid,
            clickedPlaceId: placeId,
            clickedCuratorId: curatorId,
            placeName,
            source: clickSource,
            user,
            searchLogId: lastSearchLogIdRef.current,
            userQueryForLog: lastSearchSubmitQueryRef.current || null,
            normalizedQueryForLog: normalizedForClickLog,
            searchFeedbackRpcArea: fbCtx?.area ?? null,
            searchFeedbackRpcIntentTags: fbCtx?.intentTags ?? null,
            searchClickPath: clickPath,
            ...(Number.isFinite(cr) && cr > 0 ? { clickedRank: Math.round(cr) } : {}),
            ...(Number.isFinite(visible) && visible >= 0
              ? { userVisibleCandidateCount: Math.round(visible) }
              : {}),
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
      aiRecommendExclusiveRef.current = false;
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

        const handle = String(data.slug || data.username || "").trim();
        const nick = String(data.name || data.display_name || handle || "").trim();
        setCuratorProfile({
          id: data.id,
          user_id: data.user_id,
          username: handle,
          displayName: nick,
          bio: data.bio,
          image: curatorRowProfileImage(data),
        });
        console.log("✅ 큐레이터 프로필 로드됨:", handle);

        // 큐레이터 로그인 시 팔로우 알림 확인
        setTimeout(() => {
          checkUnreadFollowers(data.id);
        }, 1500);
      } else if (isUserCurator) {
        // 기존 큐레이터도 팔로우 알림 확인
        const handle = String(data.slug || data.username || "").trim();
        const nick = String(data.name || data.display_name || handle || "").trim();
        setCuratorProfile({
          id: data.id,
          user_id: data.user_id,
          username: handle,
          displayName: nick,
          bio: data.bio,
          image: curatorRowProfileImage(data),
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
            "id, user_id, username, slug, name, display_name, bio, image, avatar_url, grade"
          )
          .order("created_at", { ascending: false });
          
        if (error) {
          console.error("큐레이터 로드 오류:", error);
          curatorAttachRowsRef.current = [];
          setDbCurators([]);
          return;
        }

        curatorAttachRowsRef.current = data || [];

        // CuratorFilterBar: 칩 키는 slug(@핸들) → name(별명) → username → display_name → id 순
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
          const handle = slug || u;
          const nick = nm || d;
          const filterKey = handle || nick || pk;
          return {
            id: pk || filterKey,
            filterKey,
            name: nick || filterKey,
            slug: slug || null,
            username: handle || null,
            userId: userId || null,
            displayName: nick || handle || "큐레이터",
            bio: curator.bio,
            avatar: curatorRowProfileImage(curator),
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

    return () => {
      cancelled = true;
    };
    /** user.email은 환영 alert 안에서만 읽음 — id가 같은 한 reference 변화로 재실행 안 시킴 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const handle = String(data.slug || data.username || "").trim();
            const nick = String(data.name || data.display_name || handle || "").trim();
            const profile = {
              id: data.id,
              user_id: data.user_id,
              username: handle,
              displayName: nick,
              bio: data.bio,
              image: curatorRowProfileImage(data),
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
      if (!user?.id) {
        setUserSavedPlaces({});
        return;
      }

      // 임시: RPC 함수 없이 직접 쿼리 (getUser() 생략 — useAuth user로 락 경쟁 완화)
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
    /** mount-only — dbCurators 로깅은 1초 뒤 디버깅용 스냅샷 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authLoading) return;
    loadUserSavedPlaces();
    /** loadUserSavedPlaces는 매 렌더 재생성되므로 deps에 넣으면 무한 호출 — auth/user 변화에만 반응 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    /** savedMap 자체는 사용 안 하지만 isPlaceSaved가 그 storage를 참조 — 해당 변화는 refreshStorage로 별도 트리거 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // 큐레이터 칩 미선택: «전체» on → 뷰포트 bbox 장소 전부(좌표만 확인) / off → 빈 목록
    // 큐레이터 연결 여부는 마커·범례 스타일용이지, 여기서는 거르지 않음
    if (selectedCurators.length === 0) {
      if (!showAll) return [];
      return dbPlaces.filter((place) => {
        const c = resolvePlaceWgs84(place);
        return c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
      });
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
            if (cid) {
              const cCompact = cid.replace(/-/g, "");
              return ids.has(cid) || ids.has(cCompact);
            }
            const cpUser = String(cp.curators?.username ?? "").trim().toLowerCase();
            const rowUser = String(row.username ?? "").trim().toLowerCase();
            return Boolean(cpUser && rowUser && cpUser === rowUser);
          });
        })
      );
      if (rescued.length > 0) return rescued;
    }

    return filtered;
    /** curatorProfile 전체 reference 변경에는 반응 X — id/user_id/username만 추적 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    curatorProfile?.username,
    savedMap,
    userSavedPlaces,
  ]);

  const curatorSpotlightPlaces = useMemo(() => {
    const salt = curatorSpotlightSaltRef.current >>> 0;
    const fnvId = (place) => {
      const s = String(place?.id ?? place?.place_id ?? "");
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    };
    const ranked = [...dbPlaces]
      .filter((p) => (p.curatorCount || 0) >= 1)
      .sort((a, b) => {
        const dc = (b.curatorCount || 0) - (a.curatorCount || 0);
        if (dc !== 0) return dc;
        const ta = (fnvId(a) ^ salt) >>> 0;
        const tb = (fnvId(b) ^ salt) >>> 0;
        if (ta !== tb) return ta < tb ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    const pool = ranked.slice(0, 56);
    const win = 12;
    const n = pool.length;
    if (n <= win) return pool;
    const maxOff = n - win;
    const off = (salt % (maxOff + 1)) | 0;
    return pool.slice(off, off + win);
  }, [dbPlaces]);

  // 외부 데이터를 저장할 상태 추가
  const [externalPlaces, setExternalPlaces] = useState([]);
  const [externalPlacesPool, setExternalPlacesPool] = useState([]);

  const displayedPlaces = useMemo(() => {
    if (!query.trim()) {
      /** 술 칩(`omitSearchBarText`)은 query가 비지만 `externalPlacesPool`에 검색 풀이 있음 — DB 뷰포트 목록으로 덮어쓰면 안 됨 */
      if (
        preserveMapViewportSituationChip &&
        Array.isArray(externalPlacesPool) &&
        externalPlacesPool.length > 0
      ) {
        const out = [];
        const seen = new Set();
        for (const p of externalPlacesPool) {
          const id = String(p?.id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push(p);
        }
        return out;
      }
      return filteredByCuratorPlaces;
    }
    // 엔터 검색 결과는 풀 후보(externalPlacesPool)를 우선 유지한다.
    // (aiRecommendedIds만 남기면 마커/바텀시트가 과도하게 줄어듦)
    if (Array.isArray(externalPlacesPool) && externalPlacesPool.length > 0) {
      const out = [];
      const seen = new Set();
      for (const p of externalPlacesPool) {
        const id = String(p?.id ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(p);
      }
      return out;
    }
    if (aiRecommendedIds.length === 0) return filteredByCuratorPlaces;

    const idSet = new Set(aiRecommendedIds.map(String));
    const idOrderMap = new Map(
      aiRecommendedIds.map((id, index) => [String(id), index])
    );

    // 외부 풀(엔진 전체 후보) → 화면용 `externalPlaces`는 동일 id가 없을 수 있어 풀 우선
    const kakaoExternalSource =
      Array.isArray(externalPlacesPool) && externalPlacesPool.length > 0
        ? externalPlacesPool
        : externalPlaces;

    // 외부 데이터에서 AI 추천 장소 찾기
    const externalRecommendedPlaces = kakaoExternalSource
      .filter((place) => idSet.has(String(place.id)))
      .sort(
        (a, b) => idOrderMap.get(String(a.id)) - idOrderMap.get(String(b.id))
      );

    if (aiRecommendExclusiveRef.current) {
      const deduped = [];
      const seenId = new Set();
      for (const p of externalRecommendedPlaces) {
        const id = String(p?.id ?? "");
        if (!id || seenId.has(id)) continue;
        seenId.add(id);
        deduped.push(p);
      }
      if (import.meta.env.DEV) {
        console.log("🔍 displayedPlaces(추천 id만):", deduped.length, {
          external: deduped.length,
          internal: 0,
          naver: 0,
          aiIdCount: aiRecommendedIds.length,
        });
      }
      return deduped;
    }

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
  }, [
    filteredByCuratorPlaces,
    aiRecommendedIds,
    query,
    externalPlaces,
    externalPlacesPool,
    preserveMapViewportSituationChip,
  ]);

  /**
   * 지도 마커 = `displayedPlaces`(카카오·merge). import `places[].name`은 요약/블로그 제목일 수 있어
   * 검색으로 고른 ID가 있으면 바텀시트도 동일 소스로 맞춤. import만 쓰는 건 «추천」만 눌렀을 때 등.
   */
  const aiSheetUsesDisplayedPlaces =
    String(query || "").trim().length > 0 &&
    Array.isArray(displayedPlaces) &&
    displayedPlaces.length > 0;

  const useImportRecPlacesForAiSheet =
    Boolean(curatorImportRecommendation?.ok) &&
    curatorImportPlacesOrPool.length > 0 &&
    !aiSheetUsesDisplayedPlaces;

  const aiBottomSheetPlaces = useMemo(() => {
    const importPlaces = curatorImportPlacesOrPool;
    const looksKeywordLikeTitle = (name) => {
      const s = String(name || "").trim().toLowerCase();
      if (!s) return true;
      if (s.length < 2) return true;
      if (
        /(맛집|추천|데이트|분위기|핫플|가볼만|소개팅|모임|검색결과|키워드)/i.test(
          s
        )
      ) {
        return true;
      }
      if (/역맛집/.test(s)) return true;
      return false;
    };
    const hasAddressInfo = (p) =>
      Boolean(
        String(p?.address || p?.address_name || p?.road_address_name || "").trim()
      );
    const sanitizedImportName = (v) =>
      String(v || "")
        .replace(
          /^(?:.*?(?:역맛집|맛집|추천|데이트|분위기)\s+)+/i,
          ""
        )
        .replace(/^[-:|/·\s]+/, "")
        .trim();
    const pinTop3FromImport = (rows) => {
      const base = Array.isArray(rows) ? rows : [];
      if (!base.length || importPlaces.length === 0) return base;
      const extraPool = Array.isArray(externalPlacesPool)
        ? externalPlacesPool
        : [];
      const pool = [...base, ...extraPool];
      const pinned = [];
      const usedBaseIdx = new Set();
      const usedPoolKey = new Set();
      const placePoolKey = (p) =>
        String(
          p?.id ||
            `${String(p?.name || p?.place_name || "").trim().toLowerCase()}__${String(
              p?.address || p?.address_name || p?.road_address_name || ""
            )
              .trim()
              .toLowerCase()}`
        );
      const orderedNames = Array.isArray(curatorImportRecommendation?.content_order_names)
        ? curatorImportRecommendation.content_order_names
        : [];
      const top3 = importPlaces.slice(0, 3);
      const top3Wanted = orderedNames.length > 0
        ? orderedNames.slice(0, 3).map((n, i) => ({
            id: String(top3[i]?.id || "").trim(),
            name: String(n || "").trim(),
            raw: top3[i] || null,
          }))
        : top3.map((ip) => ({
            id: String(ip?.id || "").trim(),
            name: String(ip?.name || ip?.place_name || "").trim(),
            raw: ip,
          }));
      if (import.meta.env.DEV) {
        console.log(
          "[aiSheet pinTop3FromImport/wanted]",
          top3Wanted.map((w) => ({ id: w.id, name: w.name }))
        );
      }
      for (const w of top3Wanted) {
        const iid = String(w?.id || "").trim();
        const inameRaw = String(w?.name || "")
          .trim()
          .toLowerCase();
        const iname = sanitizedImportName(inameRaw).toLowerCase();
        if (!iname || looksKeywordLikeTitle(iname)) continue;
        const foundIdx = pool.findIndex((p) => {
          const pid = String(p?.id || "").trim();
          if (iid && pid && iid === pid) return true;
          const pname = String(p?.name || p?.place_name || "")
            .trim()
            .toLowerCase();
          return (
            Boolean(iname) &&
            Boolean(pname) &&
            (pname.includes(iname) || iname.includes(pname))
          );
        });
        if (foundIdx >= 0) {
          const found = pool[foundIdx];
          const k = placePoolKey(found);
          if (!k || usedPoolKey.has(k)) continue;
          usedPoolKey.add(k);
          pinned.push(found);
          const baseIdx = base.findIndex((x) => placePoolKey(x) === k);
          if (baseIdx >= 0) usedBaseIdx.add(baseIdx);
        } else if (w?.raw && typeof w.raw === "object") {
          // 미매칭 import row는 상호·주소 신뢰성이 있을 때만 상단 고정 허용
          if (!hasAddressInfo(w.raw)) continue;
          if (looksKeywordLikeTitle(iname)) continue;
          const fallback = {
            ...w.raw,
            name: sanitizedImportName(w.name || w.raw?.name || w.raw?.place_name),
            place_name: sanitizedImportName(
              w.name || w.raw?.place_name || w.raw?.name
            ),
          };
          const k = placePoolKey(fallback);
          if (!k || usedPoolKey.has(k)) continue;
          usedPoolKey.add(k);
          pinned.push(fallback);
        }
      }
      if (import.meta.env.DEV) {
        console.log("[aiSheet pinTop3FromImport]", {
          orderedNames: orderedNames.slice(0, 3),
          pinnedCount: pinned.length,
          baseCount: base.length,
          poolCount: pool.length,
        });
      }
      const rest = base.filter((_, idx) => !usedBaseIdx.has(idx));
      const out = [];
      const seen = new Set();
      for (const p of [...pinned, ...rest]) {
        const key = String(
          p?.id ||
            `${String(p?.name || p?.place_name || "").trim().toLowerCase()}__${String(
              p?.address || p?.address_name || ""
            )
              .trim()
              .toLowerCase()}`
        );
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
      if (import.meta.env.DEV) {
        console.log(
          "[aiSheet pinTop3FromImport/pinned]",
          pinned.map((p) => String(p?.name || p?.place_name || "").trim())
        );
        console.log(
          "[aiSheet pinTop3FromImport/finalTop3]",
          out.slice(0, 3).map((p) => String(p?.name || p?.place_name || "").trim())
        );
      }
      return out;
    };

    if (
      aiSheetUsesDisplayedPlaces &&
      ((Array.isArray(externalPlacesPool) && externalPlacesPool.length > 0) ||
        (Array.isArray(displayedPlaces) && displayedPlaces.length > 0))
    ) {
      const sourceRows =
        Array.isArray(externalPlacesPool) && externalPlacesPool.length > 0
          ? externalPlacesPool
          : displayedPlaces;
      return pinTop3FromImport(sourceRows);
    }
    if (importPlaces.length > 0) {
      return importPlaces;
    }
    return displayedPlaces;
  }, [
    aiSheetUsesDisplayedPlaces,
    displayedPlaces,
    curatorImportRecommendation,
    curatorImportPlacesOrPool,
    externalPlacesPool,
  ]);

  /** 바텀시트 한 페이지 행 수 — 엔진 후보 풀은 `externalPlacesPool`·`aiRecommendedIds`에 전부 실음 */
  const AI_SHEET_PAGE_SIZE = 5;
  const aiSheetTotalPages = Math.max(
    1,
    Math.ceil((aiBottomSheetPlaces?.length || 0) / AI_SHEET_PAGE_SIZE)
  );
  const aiBottomSheetPagedPlaces = useMemo(() => {
    const start = aiSheetPage * AI_SHEET_PAGE_SIZE;
    return (aiBottomSheetPlaces || []).slice(start, start + AI_SHEET_PAGE_SIZE);
  }, [aiBottomSheetPlaces, aiSheetPage]);
  const [aiSheetPhotoViewerOpen, setAiSheetPhotoViewerOpen] = useState(false);
  const [aiSheetPhotoViewerIndex, setAiSheetPhotoViewerIndex] = useState(0);
  /** 배경 탭으로 닫은 뒤 같은 포인터 이벤트가 썸네일로 떨어져 라이트박스가 즉시 다시 열리는 것 방지 */
  const aiSheetPhotoViewerSuppressOpenUntilRef = useRef(0);

  const closeAiSheetPhotoViewer = useCallback(() => {
    setAiSheetPhotoViewerOpen(false);
    aiSheetPhotoViewerSuppressOpenUntilRef.current = Date.now() + 480;
  }, []);

  useEffect(() => {
    if (!aiSheetOpen) {
      setAiSheetPhotoViewerOpen(false);
    }
  }, [aiSheetOpen]);

  useEffect(() => {
    if (!aiSheetPhotoViewerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeAiSheetPhotoViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiSheetPhotoViewerOpen, closeAiSheetPhotoViewer]);

  useEffect(() => {
    if (aiSheetPage >= aiSheetTotalPages) {
      setAiSheetPage(Math.max(0, aiSheetTotalPages - 1));
    }
  }, [aiSheetPage, aiSheetTotalPages]);

  const aiSheetPlacePreviewKey = useCallback((place) => {
    const id = String(place?.id || "").trim();
    if (id) return id;
    const nm = String(place?.name || place?.place_name || "").trim();
    const ad = String(place?.address || place?.address_name || "").trim();
    return `${nm}__${ad}`;
  }, []);

  const aiSheetPhotoViewerItems = useMemo(() => {
    const out = [];
    for (const p of aiBottomSheetPagedPlaces || []) {
      const key = aiSheetPlacePreviewKey(p);
      const enrichedPhoto = key ? aiSheetPhotoByKey[key] : "";
      const previewImageUrl = [
        enrichedPhoto,
        p?.thumbnail,
        p?.thumbnail_url,
        p?.image,
        p?.image_url,
        p?.photo,
        p?.photo_url,
        p?.picture,
      ]
        .map((v) => String(v || "").trim())
        .find((v) => /^https?:\/\//i.test(v) || v.startsWith("/api/"));
      const wgs = resolvePlaceWgs84(p);
      const lat = Number(wgs?.lat);
      const lng = Number(wgs?.lng);
      const fallbackStaticMapUrl =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? buildKakaoStaticMapUrl(lat, lng, { w: 900, h: 640, level: 4 })
          : "";
      const src = previewImageUrl || fallbackStaticMapUrl || "";
      if (!src) continue;
      out.push({
        key,
        src,
        title: String(p?.name || p?.place_name || "장소 사진").trim(),
      });
    }
    return out;
  }, [aiBottomSheetPagedPlaces, aiSheetPhotoByKey, aiSheetPlacePreviewKey]);

  useEffect(() => {
    if (!aiSheetOpen || !Array.isArray(aiBottomSheetPlaces) || aiBottomSheetPlaces.length === 0) {
      return;
    }
    const ac = new AbortController();

    const run = async () => {
      for (const p of aiBottomSheetPlaces.slice(0, 8)) {
        if (ac.signal.aborted) break;
        const key = aiSheetPlacePreviewKey(p);
        if (!key || aiSheetPhotoByKey[key]) continue;
        const name = String(p?.name || p?.place_name || "").trim();
        if (!name) continue;
        const address = String(p?.address || p?.address_name || "").trim();
        const wgs = resolvePlaceWgs84(p);
        const lat = Number(wgs?.lat);
        const lng = Number(wgs?.lng);
        const kakaoId = normalizeKakaoPlaceId(p);
        // 1) 카카오 상세 썸네일 우선 시도 (가게 사진 체감이 가장 자연스러움)
        if (kakaoId) {
          try {
            const kakaoInfo = await getKakaoPlaceBasicInfoViaProxy(kakaoId, {
              query: name,
              ...(Number.isFinite(lng) ? { x: lng } : {}),
              ...(Number.isFinite(lat) ? { y: lat } : {}),
            });
            const kakaoThumb = String(kakaoInfo?.thumbnail_url || "").trim();
            if (kakaoThumb) {
              setAiSheetPhotoByKey((prev) =>
                prev[key] ? prev : { ...prev, [key]: kakaoThumb }
              );
              continue;
            }
          } catch {
            /* no-op */
          }
        }
        const qs = new URLSearchParams({ name });
        if (address) qs.set("address", address);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          qs.set("lat", String(lat));
          qs.set("lng", String(lng));
        }
        try {
          const res = await fetch(`/api/google-place-photos?${qs.toString()}`, {
            signal: ac.signal,
          });
          const data = await res.json().catch(() => null);
          const first = Array.isArray(data?.imageUrls)
            ? String(data.imageUrls[0] || "").trim()
            : "";
          if (first) {
            setAiSheetPhotoByKey((prev) =>
              prev[key] ? prev : { ...prev, [key]: first }
            );
          }
        } catch {
          /* no-op */
        }
      }
    };
    void run();
    return () => ac.abort();
  }, [aiSheetOpen, aiBottomSheetPlaces, aiSheetPlacePreviewKey, aiSheetPhotoByKey]);

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
    const applySituation = (rows) =>
      situationFolderFilter
        ? filterPlacesBySituationFolder(
            rows,
            situationFolderFilter,
            userSavedPlaces,
            { varietySeed: situationFolderFilter }
          )
        : rows;

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

    /**
     * 술 상황 칩: `omitSearchBarText`로 `query`가 비어도 `aiRecommendedIds`가 채워지면
     * 아래 「AI+기존 마커 병합」 분기로 들어가 뷰포트 DB `displayedPlaces`(~120)까지 합쳐진다.
     * 칩 의도는 「펼친 화면 안 검색 핀만」이므로 베이스는 붙이지 않는다.
     */
    if (
      preserveMapViewportSituationChip &&
      !showSavedOnly &&
      !isCourseMode &&
      !curatorPinsOnly
    ) {
      const chipOnly = mergePlaces(kPins, kTypingPins);
      return appendSelectedPlacePinIfMissing(
        applySituation(
          applyLegendCategoryFilter(
            dedupeMapPlacesByKakaoId(chipOnly),
            legendCategory
          )
        ),
        selectedPlace
      );
    }

    // 별표 버튼(showSavedOnly)이 켜져 있으면 모든 장소 표시 (큐레이터 기능)
    if (showSavedOnly) {
      if (import.meta.env.DEV) {
        console.log("⭐ mapDisplayedPlacesWithLegend (저장만):", displayedPlaces.length);
      }
      // 동일 id면 검색/카카오 쪽(isKakaoPlace)이 먼저 오도록 — 앞선 항목이 병합 시 유지됨
      return appendSelectedPlacePinIfMissing(
        applySituation(
          applyLegendCategoryFilter(
            dedupeMapPlacesByKakaoId(
              mergePlaces(mergePlaces(displayedPlaces, kPins), kTypingPins)
            ),
            legendCategory
          )
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
            applySituation(
              applyLegendCategoryFilter(
                courseSecondPulsePlacesForMap,
                legendCategory
              )
            ),
            selectedPlace
          );
        }
        return appendSelectedPlacePinIfMissing(
          applySituation(
            applyLegendCategoryFilter(
              dedupeMapPlacesByKakaoId([...kakaoPlaces]),
              legendCategory
            )
          ),
          selectedPlace
        );
      }
      return appendSelectedPlacePinIfMissing(
        applySituation(
          applyLegendCategoryFilter(dedupeMapPlacesByKakaoId([]), legendCategory)
        ),
        selectedPlace
      );
    }

    // AI/검색 결과가 있어도 기존 마커는 유지하고 검색 마커를 추가 표시
    if (aiRecommendedIds.length > 0 || query.trim()) {
      const filteredBase = displayedPlaces.filter((place) => place.is_public !== false);
      if (aiRecommendExclusiveRef.current && aiRecommendedIds.length > 0) {
        return appendSelectedPlacePinIfMissing(
          applySituation(
            applyLegendCategoryFilter(
              dedupeMapPlacesByKakaoId([...filteredBase]),
              legendCategory
            )
          ),
          selectedPlace
        );
      }
      /** 검색 로딩 중·추천 id 아직 없음: 뷰포트 DB 전부 깔지 않음 → 소개팅 등에서 백반집 착시 방지 */
      /** 확장 제안 패널(결과 부족)일 때도 동일 — 추천 0인데 베이스 120개 깔리면 혼란 */
      if (
        (isAiSearching && aiRecommendedIds.length === 0) ||
        (searchExpandUX &&
          !isAiSearching &&
          aiRecommendedIds.length === 0 &&
          String(query || "").trim().length > 0)
      ) {
        const waitMerged = mergePlaces(kPins, kTypingPins);
        return appendSelectedPlacePinIfMissing(
          applySituation(
            applyLegendCategoryFilter(
              dedupeMapPlacesByKakaoId(waitMerged),
              legendCategory
            )
          ),
          selectedPlace
        );
      }
      const merged = mergePlaces(
        mergePlaces(filteredBase, kPins),
        kTypingPins
      );
      if (import.meta.env.DEV) {
        console.log("🔍 AI+기존 마커 병합:", merged.length, {
          base: filteredBase.length,
          kakao: kPins.length,
        });
      }
      return appendSelectedPlacePinIfMissing(
        applySituation(
          applyLegendCategoryFilter(
            dedupeMapPlacesByKakaoId(merged),
            legendCategory
          )
        ),
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
      mergePlaces(mergePlaces(filtered, kPins), kTypingPins)
    ); // 동일 id면 확정 검색·displayedPlaces 쪽을 먼저 두어 예전 kPins(DB 오좌표)가 덮어쓰지 않게 함
    if (import.meta.env.DEV) {
      console.log("🗺️ mapDisplayedPlacesWithLegend 최종:", result.length);
    }

    return appendSelectedPlacePinIfMissing(
      applySituation(applyLegendCategoryFilter(result, legendCategory)),
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
    situationFolderFilter,
    userSavedPlaces,
    isAiSearching,
    searchExpandUX,
    preserveMapViewportSituationChip,
  ]);

  const hotStripPlaceRows = useMemo(() => {
    const byId = new Map();
    const ingest = (raw, bonus = 0) => {
      const row = toHotStripRow(raw, bonus);
      if (!row) return;
      const prev = byId.get(row.place_id);
      if (!prev || Number(row._score) > Number(prev._score)) {
        byId.set(row.place_id, row);
      }
    };

    for (const r of rankingTop5) ingest(r, 120);
    for (const p of curatorSpotlightPlaces || []) ingest(p, 90);
    for (const p of mapDisplayedPlacesWithLegend.slice(0, 80)) {
      const rawPickish =
        Number(
          p?.pick_weighted ?? p?.pick_w ?? p?.pick_count ?? p?.total_picks ?? 0
        ) || 0;
      const savedBonus = userSavedPlaces?.[p?.id] ? 45 : 0;
      ingest(p, rawPickish * 2 + savedBonus + 15);
    }

    const pool = Array.from(byId.values()).sort((a, b) => b._score - a._score);
    const stripScore = (item) => {
      const rest = { ...item };
      delete rest._score;
      return rest;
    };
    if (pool.length <= 5) return pool.map(stripScore);

    const topBucket = pool.slice(0, Math.min(14, pool.length));
    const picked = shuffleArray(topBucket).slice(0, 5);
    return picked.map(stripScore);
  }, [
    rankingTop5,
    curatorSpotlightPlaces,
    mapDisplayedPlacesWithLegend,
    userSavedPlaces,
  ]);

  useLayoutEffect(() => {
    const tick = mapSearchMarkerFitTick;
    if (tick === 0) return;

    const pad = mapSearchPlacesFitPadding;
    const rows = mapDisplayedPlacesWithLegend.filter((p) => {
      const w = resolvePlaceWgs84(p);
      return w && isLikelyKoreaWgs84(w.lat, w.lng);
    });
    if (rows.length === 0) return;

    if (lastHandledMapSearchFitTickRef.current >= tick) return;
    lastHandledMapSearchFitTickRef.current = tick;

    const run = () => {
      try {
        mapRef.current?.relayout?.();
        mapRef.current?.fitToPlaces?.(rows, pad ?? undefined);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[map] fit to displayed search markers", e);
        }
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(run, 48);
      });
    });
  }, [
    mapSearchMarkerFitTick,
    mapDisplayedPlacesWithLegend,
    mapSearchPlacesFitPadding,
  ]);

  const recommendHighlightedMapPlaces = useMemo(() => {
    if (!curatorImportRecommendation?.ok) return [];
    return getHighlightedPlaces(
      mapDisplayedPlacesWithLegend,
      curatorImportRecommendation,
    );
  }, [mapDisplayedPlacesWithLegend, curatorImportRecommendation]);

  const handleRecommendPlaceFromList = useCallback(
    (recPlace) => {
      const matchedPlace = findMatchedMapPlace(
        recPlace,
        mapDisplayedPlacesWithLegend,
      );
      openRecommendedPlace(recPlace, matchedPlace);
      const mapTarget = matchedPlace ?? recPlace;
      const w = resolvePlaceWgs84(mapTarget);
      if (w) {
        if (mapRef.current?.panToAbovePreview) {
          mapRef.current.panToAbovePreview(w.lat, w.lng);
        } else {
          mapRef.current?.moveToLocation?.(w.lat, w.lng);
        }
      }
      if (mapTarget) {
        setSelectedPlaceWithAnalytics(mapTarget, "recommend_list");
      }
    },
    [
      mapDisplayedPlacesWithLegend,
      openRecommendedPlace,
      setSelectedPlaceWithAnalytics,
    ],
  );

  useMapCenterOnFirstHighlighted(mapRef, recommendHighlightedMapPlaces);

  useEffect(() => {
    if (!selectedPlace) closeRecommendedPlaceDetail();
  }, [selectedPlace, closeRecommendedPlaceDetail]);

  // 카카오 자동완성 후보가 전국·광역으로 퍼질 수 있어 fitToPlaces(setBounds)를 쓰면
  // 타이핑만 해도 지도가 줌아웃됨. 검색어가 있을 땐 MapView `preserveViewportOnPlacesChange`로
  // 마커만 갱신하고 줌/센터는 유지.
  // 검색 제출로 확정된 추천 마커는 `mapSearchMarkerFitTick` → 레이아웃 이후 `fitToPlaces`로 맞춤.

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
    const importPlaces =
      curatorImportRecommendation?.ok && curatorImportPlacesOrPool.length > 0
        ? curatorImportPlacesOrPool
        : null;
    const byId = new Map();
    for (const p of displayedPlaces) {
      const id = String(p.id);
      const fromImport = importPlaces
        ? importReasonLineForPlace(p, importPlaces)
        : "";
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
          fromImport ||
          p.reasonShort ||
          p.whyRecommended ||
          buildRecommendationWhyLine(p, parsed),
      });
    }
    return { parsed, byId };
  }, [displayedPlaces, query, curatorImportRecommendation, curatorImportPlacesOrPool]);

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
  setMapSearchMarkerFitTick(0);
  lastHandledMapSearchFitTickRef.current = 0;
  setKakaoPlaces([]); // 카카오 장소들도 정리
  setKakaoTypingPreviewPlaces([]);
  setAiError("");
  setAiSummary("");
  setAiReasons([]);
  setAiRecommendedIds([]);
  aiRecommendExclusiveRef.current = false;
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
  setPreserveMapViewportSituationChip(false);
  situationChipMapSearchViewportRef.current = false;
  setRegionBoundaryOverlay(null);
  courseGpsUserOriginRef.current = null;
  setCourseGpsRadiusM(COURSE_GPS_DEFAULT_RADIUS_M);
  setCourseSearchUsedGpsOrigin(false);
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

  /** 검색바 엔터/검색 버튼으로 나온 결과: 후보가 1곳일 때만 미리보기 카드 자동 오픈 (여러 핀일 땐 사용자가 핀 선택) */
  const openPreviewForFirstSearchResult = useCallback(
    (
      kakaoFormattedPlaces,
      analyticsSource = "search_bar_submit",
      rawQuery
    ) => {
      const rq = typeof rawQuery === "string" ? rawQuery.trim() : "";
      if (
        rq &&
        isCourseQuery(rq) &&
        !homeSearchSkipCoursePreviewRef.current
      )
        return;
      if (
        !Array.isArray(kakaoFormattedPlaces) ||
        kakaoFormattedPlaces.length === 0
      ) {
        return;
      }
      if (kakaoFormattedPlaces.length > 1) {
        return;
      }
      const first = kakaoFormattedPlaces[0];
      const merged = mergePickedPlaceWithCuratorCatalog(
        first,
        curatorPlaceCatalogForMerge
      );
      setSelectedPlaceWithAnalytics(merged, analyticsSource, {
        clickedRank: 1,
        userVisibleCandidateCount: kakaoFormattedPlaces.length,
      });
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

  const handleSearchSubmit = async (value, options = {}) => {
    const nextQuery = normalizeHangulSearchCompounds(value.trim());
    const submitTargetMode =
      options?.targetMode === "user" ? "user" : searchTargetMode;
    const skipCourseRecommendation = Boolean(options?.skipCourseRecommendation);
    const omitSearchBarText = Boolean(options?.omitSearchBarText);
    const chipResultProfile = String(options?.chipResultProfile || "").trim();
    homeSearchSkipCoursePreviewRef.current =
      skipCourseRecommendation && submitTargetMode !== "user";

    if (submitTargetMode === "user") {
      const handleQuery = String(nextQuery || "").replace(/^@+/, "").trim();
      setQuery(nextQuery);
      if (!handleQuery) {
        showToast("@유저 핸들을 입력해 주세요.", "info", 2400);
        return;
      }
      try {
        setIsAiSearching(true);
        setSearchLoadingLabel("유저 찾는 중…");
        const escaped = handleQuery.replace(/[%_]/g, "\\$&");
        const [usernameRes, displayRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name")
            .ilike("username", `%${escaped}%`)
            .limit(8),
          supabase
            .from("profiles")
            .select("id, username, display_name")
            .ilike("display_name", `%${escaped}%`)
            .limit(8),
        ]);
        if (usernameRes.error) throw usernameRes.error;
        if (displayRes.error) throw displayRes.error;

        const merged = [...(usernameRes.data || []), ...(displayRes.data || [])];
        const seen = new Set();
        const rows = merged.filter((row) => {
          const id = String(row?.id || "");
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        const exact = rows.find(
          (row) =>
            String(row?.username || "").trim().toLowerCase() ===
            handleQuery.toLowerCase()
        );
        const best = exact || (rows.length === 1 ? rows[0] : null);

        if (!best?.id) {
          if (rows.length > 1) {
            showToast(
              `유저가 ${rows.length}명 보여요. @핸들을 더 정확히 입력해 주세요.`,
              "info",
              2800
            );
          } else {
            showToast("일치하는 유저를 찾지 못했어요.", "info", 2600);
          }
          return;
        }
        navigate(`/u/${best.id}`);
      } catch (err) {
        console.warn("user handle search:", err?.message || err);
        showToast("유저 검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", "error", 2800);
      } finally {
        setIsAiSearching(false);
      }
      return;
    }
    const naturalQ = parseNaturalQuery(nextQuery);
    /** 칩 단발: GPS·내 위치 핀 무시하고 **현재 지도 화면** 기준 검색만 */
    const chipAnchorsMapViewport = Boolean(options?.mapViewportChipSearch);
    if (chipAnchorsMapViewport) {
      setPreserveMapViewportSituationChip(true);
      situationChipMapSearchViewportRef.current = true;
    } else {
      setPreserveMapViewportSituationChip(false);
      situationChipMapSearchViewportRef.current = false;
    }
    const effectiveLocationPinned = chipAnchorsMapViewport
      ? false
      : isLocationBasedSearch;

    /** 칩 단발 검색 등: `1차`가 있어도 코스 루트로 보내지 않음 */
    const useCoursePipeline =
      !skipCourseRecommendation && isCourseQuery(nextQuery);
    const namesGeographicArea =
      Boolean(naturalQ.region) || Boolean(findAreaKeywordInQuery(nextQuery));
    const explicitNearMe =
      !chipAnchorsMapViewport &&
      /내\s*위치|내위치|내\s*근처|내\s*주변|내\s*주위|여기\s*근처|현재\s*위치/i.test(
        nextQuery
      );
    const vagueNear = /근처|주변|주위/.test(nextQuery);
    /** 홈 검색바 플레이스홀더·즉시 술집 탐색 문장 — 동네명 없으면 내 위치 반경 검색이 자연스러움 */
    const implicitNearbyNowIntent =
      /지금\s*한잔\s*하기\s*좋은|한잔하기\s*좋은\s*곳/i.test(nextQuery);
    /** `parseNaturalQuery`의 도보 의도(걸어·가까운 등) + 문장형(걸어가기 좋은) */
    const walkIntent =
      Boolean(naturalQ.wantsWalkingDistance) ||
      /걸어서|도보|걸어가기|걸어갈|걸어다니기/i.test(nextQuery);

    /** 코스+주변 의도: 검색 직후 브라우저 위치 권한 요청 (내 위치·근처·도보 등) */
    const wantsCourseGps =
      useCoursePipeline &&
      (explicitNearMe ||
        effectiveLocationPinned ||
        walkIntent ||
        vagueNear);
    let courseGpsPromise = null;
    if (wantsCourseGps) {
      courseGpsPromise = getCurrentUserLocationStrict();
    }

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

    /** 파서/지역 사전이 «강남» 등을 잡아도, «내 위치·내 주변»이면 GPS 주변 검색으로 간다 */
    const nearbyOverridesNamedArea =
      explicitNearMe || effectiveLocationPinned;

    const shouldUseLocationSearch = chipAnchorsMapViewport
      ? false
      : (!namesGeographicArea || nearbyOverridesNamedArea) &&
        (effectiveLocationPinned ||
          explicitNearMe ||
          walkIntent ||
          vagueNear ||
          hasSearchPinAnchor ||
          implicitNearbyNowIntent);

    /** 주변 검색(핀·카드 앵커 제외): 검색 클릭 직후 브라우저 위치 권한(getCurrentPosition) 요청 */
    const wantsNearbyStrictGps =
      !useCoursePipeline &&
      shouldUseLocationSearch &&
      !hasSearchPinAnchor &&
      (explicitNearMe ||
        effectiveLocationPinned ||
        walkIntent ||
        vagueNear ||
        implicitNearbyNowIntent);
    let nearbyGpsPromise = null;
    if (wantsNearbyStrictGps) {
      nearbyGpsPromise = getCurrentUserLocationStrict();
    }

    /** UI에서 '내 주변'을 켠 경우에만 GPS 우선(렌더 시점 값 — 아래 setState 전에 캡처) */
    const userPinnedLocationSearchMode = effectiveLocationPinned;

    const applyChipResultProfileBias = (rows) => {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return list;
      const hints = DRINKS_SITUATION_CHIP_RESULT_HINTS[chipResultProfile];
      if (!hints) return list;

      const include = Array.isArray(hints.include) ? hints.include : [];
      const exclude = Array.isArray(hints.exclude) ? hints.exclude : [];
      const scored = list.map((place) => {
        const hay = [
          place?.place_name,
          place?.name,
          place?.category_name,
          place?.category,
          place?.address_name,
          place?.road_address_name,
          Array.isArray(place?.tags) ? place.tags.join(" ") : "",
        ]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        let score = 0;
        for (const token of include) {
          if (hay.includes(String(token).toLowerCase())) score += 2;
        }
        for (const token of exclude) {
          if (hay.includes(String(token).toLowerCase())) score -= 1;
        }
        return { place, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const preferred = scored.filter((x) => x.score > 0).map((x) => x.place);
      if (preferred.length >= 3) return preferred;
      if (preferred.length > 0) {
        const preferredSet = new Set(preferred.map((p) => String(p?.id || "")));
        const rest = scored
          .map((x) => x.place)
          .filter((p) => !preferredSet.has(String(p?.id || "")));
        return [...preferred, ...rest.slice(0, Math.max(0, 8 - preferred.length))];
      }
      return list;
    };

    setQuery(omitSearchBarText ? "" : nextQuery);
    lastSearchSubmitQueryRef.current = nextQuery;

    // 검색 시작 시 모든 상태 초기화
    setSelectedPlace(null);
    setAiError("");
    setAiSummary("");
    setAiReasons([]);
    setAiSheetExpandedReasonByKey({});
    setAiRecommendedIds([]);
    setAiSheetPage(0);
    lastAiScoredPlacesForImportReorderRef.current = null;
    setAiSheetOpen(false);
    setSimpleMapSearchMarkersOnly(false);
    setRegionBoundaryOverlay(null);

    // 이전 검색 결과 강제 초기화
    setExternalPlaces([]);
    setExternalPlacesPool([]);
    setKakaoPlaces([]);
    setKakaoTypingPreviewPlaces([]);
    setBlogReviews([]);
    setSearchExpandUX(null);
    setYajangFallbackBanner(null);
    setSearchDistanceOrigin(null);
    resetCourseSearch();
    courseGpsUserOriginRef.current = null;
    setCourseGpsRadiusM(COURSE_GPS_DEFAULT_RADIUS_M);
    setCourseSearchUsedGpsOrigin(false);

    console.log('🧹 모든 검색 상태 초기화 완료');

    if (!nextQuery) {
      homeSearchSkipCoursePreviewRef.current = false;
      aiRecommendExclusiveRef.current = false;
      forceReopenAiSheetAfterSearchRef.current = false;
      return;
    }

    const searchSessionId = crypto.randomUUID();
    searchSessionIdRef.current = searchSessionId;
    lastSearchSubmitTelemetryRef.current = null;
    lastSearchLogIdRef.current = null;
    searchFeedbackContextRef.current = null;

    const searchUiStartedAt = Date.now();
    const MIN_SEARCH_LOADING_MS = 1800;
    let shouldOpenAiSheetAfterLoad = false;
    let searchHadError = false;
    let searchResultIdsForLog = [];
    let searchModeForLog = shouldUseLocationSearch ? "nearby" : "map";
    /** 단일 검색창: 입력만으로 keyword_search vs ai_parse_search (채널 버튼 없음) */
    const searchExecutionKind = detectHomeSearchExecutionKind(
      nextQuery,
      naturalQ
    );
    const useBasicSearchPipeline =
      searchExecutionKind === HOME_SEARCH_KIND.KEYWORD_SEARCH;
    /** keyword 1차 후 결과 부족 시 AI 보조로 바뀌면 false로 덮어씀 */
    let pipelineIsBasic = useBasicSearchPipeline;
    let telemetryKeywordAiFallback = false;
    let telemetryPreFallbackResultCount = null;
    let telemetryQualitySummary = null;
    let telemetryPipelineScreenRowCount = null;
    let telemetryEngineScoredPoolSize = null;
    if (useBasicSearchPipeline) {
      searchModeForLog = `${searchModeForLog}_basic`;
    }
    aiRecommendExclusiveRef.current = !useBasicSearchPipeline;
    let skipMinSearchLoading = useBasicSearchPipeline;

    const normalizedQueryForFeedback = normalizeQueryForFeedback(nextQuery);
    let searchScoreOptsBase = { searchFeedbackByPlaceKey: {} };

    try {
      setIsAiSearching(true);
      setSearchLoadingLabel(
        useBasicSearchPipeline
          ? "장소 검색 중…"
          : wantsCourseGps && courseGpsPromise
            ? "위치 확인 중… (브라우저 창에서 허용 여부를 선택해 주세요)"
            : wantsNearbyStrictGps && nearbyGpsPromise
              ? "위치 확인 중… (브라우저 창에서 허용 여부를 선택해 주세요)"
              : getSearchLoadingMessage(nextQuery)
      );

      try {
        searchScoreOptsBase = {
          searchFeedbackByPlaceKey: await fetchSearchFeedbackBoostMap(
            normalizedQueryForFeedback
          ),
        };
      } catch (fbPreErr) {
        if (import.meta.env.DEV) {
          console.warn("[search-feedback] prefetch:", fbPreErr);
        }
      }

      const withSearchSocialBoost = async (places, extra = {}) => {
        const base = { ...searchScoreOptsBase, ...extra };
        try {
          const social = await fetchSearchSocialBoostByPlaces(
            supabase,
            places
          );
          if (
            social &&
            typeof social === "object" &&
            Object.keys(social).length > 0
          ) {
            return { ...base, socialBoostByStableKey: social };
          }
        } catch (socErr) {
          if (import.meta.env.DEV) {
            console.warn("[search] social boost prefetch:", socErr);
          }
        }
        return base;
      };

      if (useCoursePipeline) {
        clearImportRecommendationOverlay();
        searchModeForLog = "course";
        let courseLoadOpts;
        let courseSearchOriginKind = "global";

        const kwStripCourse =
          stripPartyAndChatterForKeywordSearch(nextQuery) || nextQuery;
        const namedLocationForCourse =
          extractHomeMapLocationName(kwStripCourse);
        /** 지명이 있는데 GPS·핀·「내 위치」모드가 아니면 코스 후보를 그 일대로 한정 */
        const preferNamedAreaCourseOrigin =
          Boolean(namedLocationForCourse) &&
          !explicitNearMe &&
          !hasSearchPinAnchor &&
          !isLocationBasedSearch;

        if (
          preferNamedAreaCourseOrigin &&
          mapRef?.current &&
          window.kakao?.maps?.services
        ) {
          const panKw = mapPanAnchorKeyword(
            namedLocationForCourse,
            namedLocationForCourse
          );
          try {
            const coords = await new Promise((resolve) => {
              const ps = new window.kakao.maps.services.Places();
              ps.keywordSearch(panKw, (data, status) => {
                if (
                  status === window.kakao.maps.services.Status.OK &&
                  Array.isArray(data) &&
                  data.length > 0
                ) {
                  resolve({
                    lat: parseFloat(data[0].y),
                    lng: parseFloat(data[0].x),
                  });
                } else {
                  resolve(null);
                }
              });
            });
            if (
              coords &&
              Number.isFinite(coords.lat) &&
              Number.isFinite(coords.lng)
            ) {
              courseLoadOpts = {
                userOrigin: coords,
                /** 을지로 등 지명 앵커 시 성수·성동 쪽까지 넓게 잡히지 않게 상한을 낮춤 */
                maxDistanceMeters: 3200,
                strictNearbyOnly: true,
              };
              courseSearchOriginKind = "named_area";
              if (mapRef.current.moveToLocation) {
                mapRef.current.moveToLocation(coords.lat, coords.lng);
              }
              mapRef.current.setZoomLevel?.(5);
            }
          } catch (panErr) {
            if (import.meta.env.DEV) {
              console.warn("코스 지명 앵커:", panErr);
            }
          }
        }

        if (!courseLoadOpts?.userOrigin && wantsCourseGps && courseGpsPromise) {
          try {
            const pos = await courseGpsPromise;
            courseLoadOpts = {
              userOrigin: pos,
              maxDistanceMeters: COURSE_GPS_DEFAULT_RADIUS_M,
              strictNearbyOnly: true,
            };
            courseSearchOriginKind = "gps";
            courseGpsUserOriginRef.current = pos;
            setCourseGpsRadiusM(COURSE_GPS_DEFAULT_RADIUS_M);
            setCourseSearchUsedGpsOrigin(true);
            setCurrentLocation(pos);
            if (mapRef?.current?.moveToLocation) {
              mapRef.current.moveToLocation(pos.lat, pos.lng);
            }
          } catch (locErr) {
            console.warn("코스 주변 위치:", locErr);
            const denied = Number(locErr?.code) === 1;
            const timedOut = Number(locErr?.code) === 3;
            showToast(
              denied
                ? "이전에 위치를 차단했을 수 있어요. 주소창 자물쇠(ⓘ)에서 이 사이트의 위치를 허용해 주세요."
                : timedOut
                  ? "위치 확인이 지연됐어요. 밖에서 다시 검색하거나 잠시 후 다시 시도해 주세요."
                  : "위치를 알 수 없어요. 예시 지역 코스가 나올 수 있어요.",
              "info",
              5200
            );
          }
        }

        const mergedCourseLoadOpts = {
          ...(courseLoadOpts || {}),
          includeHalfStep: courseIncludeHalfStep,
        };
        courseLastLoadOptsRef.current = mergedCourseLoadOpts;
        const res = await runCourseSearch(nextQuery, mergedCourseLoadOpts);
        if (res.handled) {
          setExternalPlaces([]);
          setExternalPlacesPool([]);
          setAiRecommendedIds([]);
          aiRecommendExclusiveRef.current = false;
          if (res.parsed) {
            setCourseIncludeHalfStep(Boolean(res.parsed.includeHalfStep));
          }
          searchResultIdsForLog = [
            ...new Set(
              (res.options || []).flatMap((c) =>
                (c.steps || []).map((s) => String(s.place?.id ?? "")).filter(Boolean)
              ),
            ),
          ];
          shouldOpenAiSheetAfterLoad = Boolean(res.options?.length);
          const stepCount = res.options?.[0]?.steps?.length ?? 0;
          const stageLabel =
            stepCount >= 3 ? "3단계(쩜오차 포함)" : "2단계";
          setAiSummary(
            res.options?.length
              ? courseSearchOriginKind === "named_area"
                ? `「${namedLocationForCourse}」 일대를 기준으로 짠 ${stageLabel} 코스예요.`
                : courseLoadOpts?.userOrigin &&
                    courseSearchOriginKind === "gps"
                  ? `내 위치 기준 ${COURSE_GPS_DEFAULT_RADIUS_M / 1000}km 안에서 짠 ${stageLabel} 코스예요.`
                  : `큐레이터·태그·거리 기준으로 짠 ${stageLabel} 코스예요.`
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

        let strictNearbyOrigin = null;
        let strictNearbyGpsFailed = false;
        if (nearbyGpsPromise) {
          try {
            strictNearbyOrigin = await nearbyGpsPromise;
            setCurrentLocation(strictNearbyOrigin);
            if (mapRef?.current?.moveToLocation) {
              mapRef.current.moveToLocation(
                strictNearbyOrigin.lat,
                strictNearbyOrigin.lng
              );
            }
          } catch (locErr) {
            strictNearbyGpsFailed = true;
            console.warn("주변 검색 위치:", locErr);
            const denied = Number(locErr?.code) === 1;
            const timedOut = Number(locErr?.code) === 3;
            showToast(
              denied
                ? "이전에 위치를 차단했을 수 있어요. 주소창 자물쇠(ⓘ)에서 이 사이트의 위치를 허용해 주세요."
                : timedOut
                  ? "위치 확인이 지연됐어요. 지도 중심으로 찾을게요. 밖에서 다시 시도해 보세요."
                  : "위치를 알 수 없어요. 지도 중심 기준으로 찾을게요.",
              "info",
              5200
            );
          }
        }

        const resolveNearbySearchOrigin = async () => {
          if (searchAnchorCoords) {
            return {
              lat: searchAnchorCoords.lat,
              lng: searchAnchorCoords.lng,
            };
          }
          /** 검색 직후 받은 GPS — 근처/도보 등에서도 지도 중심보다 우선 */
          if (strictNearbyOrigin) {
            return {
              lat: strictNearbyOrigin.lat,
              lng: strictNearbyOrigin.lng,
            };
          }
          // "이 근처·근처·주변"만 쓴 경우: 지도에 맞춰 본 위치가 기준 (GPS는 내 위치 모드일 때만 우선)
          const useDeviceGps =
            explicitNearMe || userPinnedLocationSearchMode;
          if (!useDeviceGps) {
            const fromMap = readKakaoMapCenterLatLng(mapRef);
            if (fromMap) return fromMap;
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
          if (useDeviceGps && strictNearbyGpsFailed) {
            const fromMap = readKakaoMapCenterLatLng(mapRef);
            if (fromMap) return fromMap;
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
              nextQuery
            );
        console.log('🍺 위치 기반 검색 결과:', nearbyPlaces.length, {
          keyword: nearbyKeyword,
          intentAssist: !!intentAssist,
        });

        // 3. AI 스코어링 + 결과 없으면 확장 쿼리로 자동 1~2회 재시도
        let scoredPlaces = calculateLocalAIScores(
          nearbyPlaces,
          nextQuery,
          userLocation,
          null,
          await withSearchSocialBoost(nearbyPlaces)
        );
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
            );
            const sp = calculateLocalAIScores(
              npFiltered,
              nextQuery,
              userLocation,
              null,
              await withSearchSocialBoost(npFiltered)
            );
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

        if (
          useBasicSearchPipeline &&
          scoredPlaces.length < KEYWORD_SEARCH_FALLBACK_MIN_RESULTS
        ) {
          telemetryPreFallbackResultCount = scoredPlaces.length;
          try {
            const intentAssistFb = await Promise.race([
              fetchSearchIntentAssist(nextQuery),
              new Promise((resolve) =>
                setTimeout(() => resolve(null), SEARCH_INTENT_ASSIST_MS)
              ),
            ]);
            const kakaoHintFb =
              intentAssistFb?.kakaoKeywordHint &&
              String(intentAssistFb.kakaoKeywordHint).trim();
            let nk = kakaoHintFb || nextQuery;
            let np = await mergeNearbyKakaoForOrQuery(nk, userLocation);
            if (
              np.length === 0 &&
              kakaoHintFb &&
              kakaoHintFb !== nextQuery.trim()
            ) {
              np = await mergeNearbyKakaoForOrQuery(nextQuery, userLocation);
            }
            if (
              np.length === 0 &&
              intentAssistFb?.broadKakaoKeyword &&
              String(intentAssistFb.broadKakaoKeyword).trim() &&
              String(intentAssistFb.broadKakaoKeyword).trim() !==
                String(nk || "").trim()
            ) {
              np = await mergeNearbyKakaoForOrQuery(
                String(intentAssistFb.broadKakaoKeyword).trim(),
                userLocation
              );
            }
            np = filterPlacesByParsedIntent(
              np,
              naturalQ.facets || parseSearchQuery(nextQuery),
              nextQuery,
            );
            const spFb = calculateLocalAIScores(
              np,
              nextQuery,
              userLocation,
              null,
              await withSearchSocialBoost(np, { keywordAiFallback: true })
            );
            if (shouldPreferFallbackSearchResults(scoredPlaces, spFb)) {
              scoredPlaces = spFb;
              pipelineIsBasic = false;
              telemetryKeywordAiFallback = true;
              aiRecommendExclusiveRef.current = true;
            }
          } catch (nearFbErr) {
            if (import.meta.env.DEV) {
              console.warn("[search] keyword→AI 주변 보조:", nearFbErr);
            }
          }
        }

        scoredPlaces = await verifyTopKakaoSearchCandidates(scoredPlaces);

        telemetryQualitySummary =
          summarizeSearchResultQualityForTelemetry(scoredPlaces);

        scoredPlaces = enrichPlacesWithReason(nextQuery, scoredPlaces, {
          keywordAiFallback: telemetryKeywordAiFallback,
        });
        logSignalsCheckDev(scoredPlaces);

        telemetryEngineScoredPoolSize = scoredPlaces.length;
        telemetryPipelineScreenRowCount = scoredPlaces.length;

        if (!pipelineIsBasic) {
          lastAiScoredPlacesForImportReorderRef.current = scoredPlaces;
        }
        // 결과 설정 — 엔진 풀 전부(바텀시트는 페이지당 5개, 이전 상위 5행 제한 제거)
        const kakaoRowFlag = (p) => ({ ...p, isKakaoPlace: true });
        setExternalPlaces(scoredPlaces.map(kakaoRowFlag));
        setExternalPlacesPool(scoredPlaces.map(kakaoRowFlag));
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
        const biasedScoredPlaces = applyChipResultProfileBias(scoredPlaces);
        const kakaoIdsAll = biasedScoredPlaces.map((p) => p.id);
        let mergedNear = kakaoIdsAll;
        if (!pipelineIsBasic) {
          setAiRecommendedIds(biasedScoredPlaces.map((p) => p.id));
        } else {
          const dbSearchNear = await fetchCuratorPlaceDbSearch(AI_API_BASE, {
            query: nextQuery,
            limit: 24,
            mode: "auto",
            maxDistanceM: 12000,
            originLat: userLocation.lat,
            originLng: userLocation.lng,
          });
          mergedNear = dbSearchNear.ok
            ? mergeDbPlaceIdsFirst(dbSearchNear.rows, kakaoIdsAll)
            : kakaoIdsAll;
          setAiRecommendedIds(mergedNear);
        }
        setBlogReviews([]);
        shouldOpenAiSheetAfterLoad = biasedScoredPlaces.length > 0;
        /** 단순 지명+메뉴 검색이어도 맞춤 피크·바텀시트는 연다(마커만 UX는 이제 쓰지 않음). */
        setSimpleMapSearchMarkersOnly(false);

        // 지도에 바로 마커 표시
        const kakaoFormattedPlaces = biasedScoredPlaces.map((place) => ({
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
        if (kakaoFormattedPlaces.length > 0 && !chipAnchorsMapViewport) {
          setMapSearchMarkerFitTick((x) => x + 1);
        }
        if (
          !chipAnchorsMapViewport &&
          !useCoursePipeline &&
          !isLikelyNaturalLanguageSearchQuery(nextQuery, naturalQ)
        ) {
          openPreviewForFirstSearchResult(
            kakaoFormattedPlaces,
            "search_bar_submit_nearby",
            nextQuery
          );
        }
        searchResultIdsForLog = (!pipelineIsBasic
          ? biasedScoredPlaces.map((p) => String(p.id))
          : mergedNear.map((id) => String(id)));

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

        const moodPreserveMap =
          homeSearchQueryHasMoodIntentHint(nextQuery) ||
          homeSearchQueryHasMoodIntentHint(kwForMap);

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
                    mapRef.current.moveToLocation(fr.y, fr.x, {
                      bottomChromePx: searchMapBottomChromePx(),
                    });
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
          setExternalPlacesPool([]);
          setAiRecommendedIds([]);
          aiRecommendExclusiveRef.current = false;
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
        const searchHereArmedAtMapStart = searchHereArmedRef.current;

        const situationChipUnifiedPhrases =
          chipAnchorsMapViewport &&
          chipResultProfile &&
          DRINKS_SITUATION_CHIP_UNIFIED_PHRASES[chipResultProfile]
            ? DRINKS_SITUATION_CHIP_UNIFIED_PHRASES[chipResultProfile]
            : null;

        let searchKeyword;
        if (locationName) {
          if (moodPreserveMap && tailAfterLocationMap) {
            searchKeyword = `${locationName} ${tailAfterLocationMap}`.trim();
          } else {
            searchKeyword = intentPhraseMap
              ? `${locationName} ${intentPhraseMap}`
              : tailAfterLocationMap
                ? `${locationName} ${tailAfterLocationMap}`
                : locationName;
          }
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
                : null;
          /** 업종·패턴에 안 걸리면 원문 그대로 검색(가게명·지역+상호 등). 예전 기본값 `음식점`은 상위 5개가 엉뚱해짐 */
          const trimmedKw = String(kwForMap || nextQuery || "").trim();
          searchKeyword = businessKeyword || trimmedKw || "음식점";
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
        if (
          locationName &&
          mapRef.current &&
          !searchHereArmedAtMapStart &&
          !chipAnchorsMapViewport
        ) {
          try {
            const panKw = mapPanAnchorKeyword(locationName, searchKeywordApi);
            // 카카오 장소 검색으로 지역명 좌표 찾기
            const ps = new window.kakao.maps.services.Places();
            
            await new Promise((resolve) => {
              ps.keywordSearch(panKw, (data, status) => {
                if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
                  const firstResult = data[0];
                  // 지도 이동 및 줌인 (하단 검색·피크 바 높이만큼 중심 보정)
                  mapRef.current.moveToLocation(firstResult.y, firstResult.x, {
                    bottomChromePx: searchMapBottomChromePx(),
                  });
                  mapRef.current.setZoomLevel(5); // 지역명 검색 시 더 좁은 범위
                  
                  console.log(`🗺️ ${panKw}으로 지도 이동 및 줌인 완료`);
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
        const lockKw = lockKeywordToClientForKakaoHint(
          nextQuery,
          facetsForFilter
        );
        let mapQuery;
        let mapFallbackQueries = [];
        if (situationChipUnifiedPhrases?.length) {
          /** 의도 보조 힌트(`지역 포차` 등)·자연어 폴백 없이 칩 전용 phrase만 사용 */
          mapQuery = situationChipUnifiedPhrases[0];
          mapFallbackQueries = situationChipUnifiedPhrases.slice(1);
        } else {
          mapQuery = lockKw
            ? clientMapQuery
            : kakaoHint
              ? mapPlaceSuffix
                ? `${kakaoHint} ${mapPlaceSuffix}`.trim()
                : kakaoHint
              : searchKeywordApi;

          const noIntentAssistAiParse =
            !useBasicSearchPipeline && !intentAssist;
          if (
            noIntentAssistAiParse &&
            !kakaoHint &&
            !lockKw &&
            isLikelyNaturalLanguageSearchQuery(nextQuery, naturalQ)
          ) {
            mapFallbackQueries = buildAiParseMapFallbackQueries(
              nextQuery,
              locationName,
              facetsForFilter
            );
            if (mapFallbackQueries.length > 0) {
              mapQuery = mapFallbackQueries[0];
            } else if (locationName) {
              mapQuery = `${locationName} 맛집`;
              mapFallbackQueries = [mapQuery];
            }
            if (import.meta.env.DEV && mapFallbackQueries.length > 0) {
              console.log("[map-fallback-query]", {
                rawQuery: nextQuery,
                region: locationName || null,
                fallbackQueries: mapFallbackQueries,
              });
            }
          }
        }

        const runSdkMapSearchWithFallbacks = async (primary, fallbacks) => {
          const fb = Array.isArray(fallbacks) ? fallbacks : [];
          const list = [primary, ...fb.filter((q) => q && q !== primary)];
          const sdkMergeMax = chipAnchorsMapViewport
            ? MAP_SDK_MERGE_MAX_SITUATION_CHIP
            : MAP_SDK_MERGE_MAX_DEFAULT;
          let acc = [];
          for (const q of list) {
            if (acc.length >= sdkMergeMax) break;
            acc = mergeMapSearchPlacesDedupe(
              acc,
              await searchMapBars(q, locationName || null)
            );
          }
          return acc;
        };

        const kwUnified = situationChipUnifiedPhrases?.length
          ? situationChipUnifiedPhrases[0]
          : moodPreserveMap
            ? (stripPartyAndChatterForKeywordSearch(nextQuery) || nextQuery).trim()
            : stripPartyAndChatterForKeywordSearch(mapQuery) || mapQuery;
        const phrasesForUnified = situationChipUnifiedPhrases?.length
          ? situationChipUnifiedPhrases
          : mergeIntentAssistIntoSearchPhrases(
              kwUnified,
              intentAssist,
              {
                maxPhrases: UNIFIED_MAP_MERGE_MAX_PHRASES,
                rawQuery: nextQuery,
              }
            );
        /**
         * 상황 칩: 내 위치 버튼 직후 등 지도 팬이 한 프레임 늦게 반영될 수 있음 —
         * bounds/sort 기준을 잡기 전에 레이아웃 한 틱 양보.
         */
        if (chipAnchorsMapViewport && typeof requestAnimationFrame !== "undefined") {
          await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          });
        }
        const mapBoundsLiveSnapshot = mapRef.current?.getBounds?.();
        const viewportCenterLatLngFromBounds = (b) => {
          if (!b || !window.kakao?.maps) return null;
          try {
            const ne = b.getNorthEast?.();
            const sw = b.getSouthWest?.();
            if (!ne || !sw) return null;
            return {
              lat: (ne.getLat() + sw.getLat()) / 2,
              lng: (ne.getLng() + sw.getLng()) / 2,
            };
          } catch {
            return null;
          }
        };
        /** 칩은 반드시 펼친 뷰포트 안만 유지해야 함 (`로` 포함 키워드가 역/동 등과 무관하게 앵커로 오인되어 필터 비활성화되는 버그 방지) */
        const geoAnchoredUnified =
          !chipAnchorsMapViewport &&
          !searchHereArmedAtMapStart &&
          kakaoQueryHasGeographicAnchor(kwUnified, locationName);

        let sortOrigin = await (async () => {
          /** 칩: 화면에 보이는 지도만 — GPS·성수 기본으로 거리 가중 주면 엇나감 */
          if (chipAnchorsMapViewport) {
            const vc = viewportCenterLatLngFromBounds(
              mapRef.current?.getBounds?.() ?? mapBoundsLiveSnapshot
            );
            if (vc) return vc;
          }
          const fromMap = readKakaoMapCenterLatLng(mapRef);
          if (fromMap) return fromMap;
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
          return {
            lat: SEONGSU_MAP_CENTER.lat,
            lng: SEONGSU_MAP_CENTER.lng,
          };
        })();

        const filterPlacesByMapViewport = (places) => {
          const bounds =
            chipAnchorsMapViewport
              ? mapRef.current?.getBounds?.() ?? mapBoundsLiveSnapshot
              : mapBoundsLiveSnapshot;
          if (
            !bounds ||
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
            return bounds.contain(
              new window.kakao.maps.LatLng(lat, lng)
            );
          });
        };

        let mapPlaces = [];
        /** 뷰포트/의도 필터로 0이 됐을 때 통합 API 후보를 버리지 않기 위한 스냅샷 */
        let unifiedMapPlacesBackup = [];
        let unifiedBlogFromServer = [];
        let unifiedApiRespondedOk = false;
        /** 상황 칩은 현재 지도 bounds만 — 통합 API는 전국 편향·지연만 키우므로 건너뜀 */
        if (!useBasicSearchPipeline && !chipAnchorsMapViewport) {
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
              unifiedMapPlacesBackup = mapPlaces.map((p) => ({ ...p }));
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
          mapPlaces = await runSdkMapSearchWithFallbacks(
            mapQuery,
            mapFallbackQueries
          );
          if (
            mapPlaces.length === 0 &&
            kakaoHint &&
            kakaoHint !== nextQuery.trim()
          ) {
            mapPlaces = await searchMapBars(
              searchKeywordApi,
              locationName || null
            );
          }
          /** SDK 0건인데 통합만 성공했던 경우 — 백업으로 복구(지역·거리 검증) — 칩은 뷰포트 밖 후보 금지 */
          if (
            mapPlaces.length === 0 &&
            unifiedMapPlacesBackup.length > 0 &&
            !chipAnchorsMapViewport
          ) {
            const gated = filterPlacesForUnifiedMapBackupRestore(
              unifiedMapPlacesBackup,
              {
                sortOrigin,
                locationName: locationName || "",
                maxDistanceKm: 12,
              }
            );
            if (import.meta.env.DEV && gated.checks?.length) {
              for (const row of gated.checks) {
                console.log("[backup-restore-check]", row);
              }
            }
            mapPlaces = gated.kept.map((p) => ({ ...p }));
          }
        } else if (!useBasicSearchPipeline && mapPlaces.length < 12) {
          /**
           * 통합 API만 쓰면 후보가 1~2곳으로 끊기는 경우가 있다(블로그·REST 편향 등).
           * 이때도 지도 SDK는 bounds·다중 쿼리로 넓게 받을 수 있으므로 합친다.
           */
          let sdkMore = await runSdkMapSearchWithFallbacks(
            mapQuery,
            mapFallbackQueries
          );
          mapPlaces = mergeMapSearchPlacesDedupe(mapPlaces, sdkMore);
          if (
            mapPlaces.length < 10 &&
            kakaoHint &&
            kakaoHint !== nextQuery.trim()
          ) {
            sdkMore = await searchMapBars(
              searchKeywordApi,
              locationName || null
            );
            mapPlaces = mergeMapSearchPlacesDedupe(mapPlaces, sdkMore);
          }
        }

        /**
         * 술 상황 칩 + 통합 검색: REST 키워드 검색은 전국 accuracy 편향 → 뷰포트 안 0건이 되기 쉬움.
         * 사용자가 본 지도 bounds 기준 카카오 SDK 후보를 항상 합친다(의도 불일치·잘못된 확장 검색 완화).
         */
        if (chipAnchorsMapViewport && mapPlaces.length > 0) {
          try {
            const sdkForChipViewport = await runSdkMapSearchWithFallbacks(
              mapQuery,
              mapFallbackQueries
            );
            mapPlaces = mergeMapSearchPlacesDedupe(
              mapPlaces,
              sdkForChipViewport
            );
          } catch (blendErr) {
            if (import.meta.env.DEV) {
              console.warn("[chip-search] 통합·SDK 블렌드:", blendErr);
            }
          }
        }

        mapPlaces = filterPlacesByMapViewport(mapPlaces);
        const chipViewportPlacesBeforeIntent =
          chipAnchorsMapViewport ? mapPlaces.slice() : null;
        mapPlaces = filterPlacesByParsedIntent(
          mapPlaces,
          facetsForFilter,
          nextQuery,
        );
        if (
          chipAnchorsMapViewport &&
          chipViewportPlacesBeforeIntent &&
          mapPlaces.length < SITUATION_CHIP_INTENT_RELAX_THRESHOLD &&
          chipViewportPlacesBeforeIntent.length > mapPlaces.length
        ) {
          const afterIntent = mapPlaces.length;
          mapPlaces = chipViewportPlacesBeforeIntent.slice(
            0,
            SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS
          );
          if (import.meta.env.DEV) {
            console.log("[chip-search] relaxed parsed-intent filter", {
              afterIntent,
              viewportOnly: chipViewportPlacesBeforeIntent.length,
              kept: mapPlaces.length,
            });
          }
        }
        /** 통합 후보는 있는데 뷰포트만 비운 경우: 의도 필터만 다시 적용해 스코어링에 넘김 */
        if (
          mapPlaces.length === 0 &&
          unifiedMapPlacesBackup.length > 0 &&
          !chipAnchorsMapViewport
        ) {
          const gated = filterPlacesForUnifiedMapBackupRestore(
            unifiedMapPlacesBackup,
            {
              sortOrigin,
              locationName: locationName || "",
              maxDistanceKm: 12,
            }
          );
          if (import.meta.env.DEV && gated.checks?.length) {
            for (const row of gated.checks) {
              console.log("[backup-restore-check]", row);
            }
          }
          mapPlaces = filterPlacesByParsedIntent(
            gated.kept,
            facetsForFilter,
            nextQuery,
          );
          if (import.meta.env.DEV) {
            console.log(
              "[map-search] viewport emptied list; scoring uses unified backup only",
              { restored: mapPlaces.length, backup: unifiedMapPlacesBackup.length }
            );
          }
        }
        /** 칩: 블렌드·통합 백업까지 막혔으면 한 번 더 SDK-only(뷰포트)·의도 과하면 SDK만이라도 노출 */
        if (chipAnchorsMapViewport && mapPlaces.length === 0) {
          try {
            let sdkChip = await runSdkMapSearchWithFallbacks(
              mapQuery,
              mapFallbackQueries
            );
            sdkChip = filterPlacesByMapViewport(sdkChip);
            const withIntent = filterPlacesByParsedIntent(
              sdkChip,
              facetsForFilter,
              nextQuery
            );
            mapPlaces = withIntent.length > 0 ? withIntent : sdkChip;
            if (import.meta.env.DEV) {
              console.log("[chip-viewport-empty-recovery]", {
                sdkInView: sdkChip.length,
                afterIntent: withIntent.length,
                kept: mapPlaces.length,
              });
            }
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn("[chip-search] viewport empty recovery:", e);
            }
          }
        }
        console.log("🗺️ 전체 지도 검색 결과:", mapPlaces.length, {
          mapQuery,
          intentAssist: !!intentAssist,
        });

        if (import.meta.env.DEV) {
          console.log("[scoring-input]", {
            unifiedBackupCount: unifiedMapPlacesBackup.length,
            mapPlacesCount: mapPlaces.length,
          });
        }

        if (chipAnchorsMapViewport) {
          const vc = viewportCenterLatLngFromBounds(
            mapRef.current?.getBounds?.() ?? mapBoundsLiveSnapshot
          );
          if (vc) sortOrigin = vc;
        }

        // 4. AI 스코어링 + 결과 없으면 확장 쿼리 자동 재시도 (추천 순서: 가까운 거리순)
        let scoredPlaces = calculateLocalAIScores(
          mapPlaces,
          nextQuery,
          null,
          sortOrigin,
          await withSearchSocialBoost(mapPlaces)
        );
        let relaxationUsedMap = null;
        if (scoredPlaces.length === 0 && !chipAnchorsMapViewport) {
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
              mp = await searchMapBars(r, locationName || null);
            }
            const mpViewport = filterPlacesByMapViewport(mp);
            const mpFiltered = filterPlacesByParsedIntent(
              mpViewport,
              facetsForFilter,
              nextQuery,
            );
            const sp = calculateLocalAIScores(
              mpFiltered,
              nextQuery,
              null,
              sortOrigin,
              await withSearchSocialBoost(mpFiltered)
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
        } else if (scoredPlaces.length === 0 && chipAnchorsMapViewport) {
          /** 칩은 화면 기준 검색만 — 무관 한 확장 토스트·UX 억제(예: 「서울 맥주」) */
          setSearchExpandUX(null);
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

        if (
          useBasicSearchPipeline &&
          scoredPlaces.length < KEYWORD_SEARCH_FALLBACK_MIN_RESULTS
        ) {
          telemetryPreFallbackResultCount = scoredPlaces.length;
          try {
            const intentAssistFb = await Promise.race([
              fetchSearchIntentAssist(nextQuery),
              new Promise((resolve) =>
                setTimeout(() => resolve(null), SEARCH_INTENT_ASSIST_MS)
              ),
            ]);
            const kwUnifiedFb = moodPreserveMap
              ? (stripPartyAndChatterForKeywordSearch(nextQuery) || nextQuery).trim()
              : stripPartyAndChatterForKeywordSearch(mapQuery) || mapQuery;
            const phrasesFb = mergeIntentAssistIntoSearchPhrases(
              kwUnifiedFb,
              intentAssistFb,
              {
                maxPhrases: UNIFIED_MAP_MERGE_MAX_PHRASES,
                rawQuery: nextQuery,
              }
            );
            const unifiedFb = await fetchUnifiedMapSearch(
              {
                query: nextQuery,
                searchPhrases:
                  phrasesFb.length > 0 ? phrasesFb : [kwUnifiedFb],
                includeBlog: false,
                blogTimeoutMs: 9000,
              },
              AI_API_BASE
            );
            let fbPlaces = [];
            if (unifiedFb?.ok === true && Array.isArray(unifiedFb.places)) {
              fbPlaces = unifiedFb.places.map((p) => ({ ...p, distance: 0 }));
            }
            const sdkFb = await searchMapBars(mapQuery, locationName || null);
            let mergedFb = mergeMapSearchPlacesDedupe(fbPlaces, sdkFb);
            mergedFb = filterPlacesByMapViewport(mergedFb);
            mergedFb = filterPlacesByParsedIntent(
              mergedFb,
              facetsForFilter,
              nextQuery,
            );
            const rescored = calculateLocalAIScores(
              mergedFb,
              nextQuery,
              null,
              sortOrigin,
              await withSearchSocialBoost(mergedFb, { keywordAiFallback: true })
            );
            if (shouldPreferFallbackSearchResults(scoredPlaces, rescored)) {
              scoredPlaces = rescored;
              pipelineIsBasic = false;
              telemetryKeywordAiFallback = true;
              aiRecommendExclusiveRef.current = true;
            }
          } catch (mapFbErr) {
            if (import.meta.env.DEV) {
              console.warn("[search] keyword→AI 지도 보조:", mapFbErr);
            }
          }
        }

        if (locationName && String(locationName).trim()) {
          const beforeGate = scoredPlaces.length;
          scoredPlaces = filterMapSearchPlacesByRegionProximity(scoredPlaces, {
            sortOrigin,
            locationName: String(locationName).trim(),
            maxDistanceKm: 12,
          });
          if (import.meta.env.DEV && beforeGate !== scoredPlaces.length) {
            console.log("[map-region-gate]", {
              locationName: String(locationName).trim(),
              dropped: beforeGate - scoredPlaces.length,
              kept: scoredPlaces.length,
            });
          }
        }

        scoredPlaces = await verifyTopKakaoSearchCandidates(scoredPlaces);

        telemetryQualitySummary =
          summarizeSearchResultQualityForTelemetry(scoredPlaces);

        console.log('🎯 AI 최종 추천:', scoredPlaces.length, relaxationUsedMap || "");

        scoredPlaces = enrichPlacesWithReason(nextQuery, scoredPlaces, {
          keywordAiFallback: telemetryKeywordAiFallback,
        });
        logSignalsCheckDev(scoredPlaces);

        let biasedScoredPlaces = applyChipResultProfileBias(scoredPlaces);

        if (chipAnchorsMapViewport && AI_API_BASE) {
          try {
            const dbChipBlend = await fetchCuratorPlaceDbSearch(AI_API_BASE, {
              query: nextQuery,
              limit: 14,
              mode: "auto",
              maxDistanceM: SITUATION_CHIP_CURATOR_API_MAX_DISTANCE_M,
              originLat: sortOrigin?.lat,
              originLng: sortOrigin?.lng,
            });
            if (dbChipBlend.ok && dbChipBlend.rows?.length) {
              biasedScoredPlaces = mergeSituationChipCuratorPlaces(
                biasedScoredPlaces,
                dbChipBlend.rows,
                dbPlaces,
                SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS,
                sortOrigin
              );
            }
          } catch (blendCurErr) {
            if (import.meta.env.DEV) {
              console.warn("[chip-search] curator blend:", blendCurErr);
            }
          }
        }

        if (
          chipAnchorsMapViewport &&
          biasedScoredPlaces.length > SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS
        ) {
          biasedScoredPlaces = biasedScoredPlaces.slice(
            0,
            SITUATION_CHIP_MAP_VIEWPORT_MAX_RESULTS,
          );
        }
        telemetryEngineScoredPoolSize = biasedScoredPlaces.length;
        telemetryPipelineScreenRowCount = biasedScoredPlaces.length;

        if (!pipelineIsBasic) {
          lastAiScoredPlacesForImportReorderRef.current = biasedScoredPlaces;
        }
        setSearchDistanceOrigin({
          lat: sortOrigin.lat,
          lng: sortOrigin.lng,
        });

        // 결과 설정 — 엔진 풀 전부(바텀시트는 AI_SHEET_PAGE_SIZE로 페이징)
        const kakaoRowMap = (p) => ({ ...p, isKakaoPlace: true });
        setExternalPlaces(biasedScoredPlaces.map(kakaoRowMap));
        setExternalPlacesPool(biasedScoredPlaces.map(kakaoRowMap));
        const intentLineMap = (() => {
          const s = intentAssist?.intentSummary && String(intentAssist.intentSummary).trim();
          if (!s) return "";
          return s.length > 36 ? `${s.slice(0, 36)}…` : s;
        })();
        setAiSummary(
          yajangBannerPayloadMap
            ? `5km 안 큐레이터 야장 ${biasedScoredPlaces.length}곳 · ${searchKeywordApi}`
            : intentLineMap
              ? `${searchKeywordApi} 검색 · ${intentLineMap}`
              : `${searchKeywordApi} 검색 결과`
        );
        setAiReasons([`${searchKeywordApi} 지역 검색`, `지도 이동 및 줌인`]);
        const kakaoIdsAllMap = biasedScoredPlaces.map((p) => p.id);
        let mergedMap = kakaoIdsAllMap;
        if (!pipelineIsBasic) {
          setAiRecommendedIds(biasedScoredPlaces.map((p) => p.id));
        } else {
          const dbSearchMap = await fetchCuratorPlaceDbSearch(AI_API_BASE, {
            query: nextQuery,
            limit: 24,
            mode: "auto",
            maxDistanceM: null,
            originLat: sortOrigin?.lat,
            originLng: sortOrigin?.lng,
          });
          mergedMap = dbSearchMap.ok
            ? mergeDbPlaceIdsFirst(dbSearchMap.rows, kakaoIdsAllMap)
            : kakaoIdsAllMap;
          setAiRecommendedIds(mergedMap);
        }
        shouldOpenAiSheetAfterLoad = biasedScoredPlaces.length > 0;
        setSimpleMapSearchMarkersOnly(false);

        // 지도에도 실시간 마커 표시 + 지도 이동 (블로그 크롤 전에 먼저 반영 — 로딩 무한 방지)
        const kakaoFormattedPlaces = biasedScoredPlaces.map((place) => ({
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
        if (kakaoFormattedPlaces.length > 0 && !chipAnchorsMapViewport) {
          setMapSearchMarkerFitTick((x) => x + 1);
        }
        if (
          !chipAnchorsMapViewport &&
          !useCoursePipeline &&
          !isLikelyNaturalLanguageSearchQuery(nextQuery, naturalQ)
        ) {
          openPreviewForFirstSearchResult(
            kakaoFormattedPlaces,
            "search_bar_submit_map",
            nextQuery
          );
        }
        searchResultIdsForLog = (!pipelineIsBasic
          ? biasedScoredPlaces.map((p) => String(p.id))
          : mergedMap.map((id) => String(id)));

        if (searchHereArmedAtMapStart) {
          searchHereArmedRef.current = false;
          setMapViewportSearchLock(false);
        }

        if (kakaoFormattedPlaces.length === 0) {
          console.log("⚠️ 검색 결과가 없거나 맵 레퍼런스가 없습니다:", {
            hasPlaces: kakaoFormattedPlaces.length > 0,
            hasMapRef: !!mapRef.current,
            kakaoApi: !!window.kakao?.maps,
          });
        }

        if (unifiedBlogFromServer.length > 0) {
          setBlogReviews(unifiedBlogFromServer);
        } else if (!unifiedApiRespondedOk && !pipelineIsBasic) {
          /** 키워드 전용(`pipelineIsBasic`)일 땐 Node 네이버 크롤(`/api/blog-reviews`) 생략 */
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
      const finalResultCount = searchResultIdsForLog.length;
      const resultDelta =
        telemetryKeywordAiFallback &&
        typeof telemetryPreFallbackResultCount === "number"
          ? finalResultCount - telemetryPreFallbackResultCount
          : null;
      emitSearchTelemetry({
        event: "search_submit",
        sessionId: searchSessionId,
        query: nextQuery,
        /** 분기 판별 직후(시작점) */
        initialKind: searchExecutionKind,
        detectedKind: searchExecutionKind,
        /** fallback·UI 분기 반영 후 */
        effectiveKind: pipelineIsBasic
          ? HOME_SEARCH_KIND.KEYWORD_SEARCH
          : HOME_SEARCH_KIND.AI_PARSE_SEARCH,
        keywordAiFallback: telemetryKeywordAiFallback,
        preFallbackResultCount: telemetryPreFallbackResultCount,
        resultDelta,
        resultCount: finalResultCount,
        pipelineScreenRowCount: telemetryPipelineScreenRowCount,
        engineScoredPoolSize: telemetryEngineScoredPoolSize,
        ...(telemetryQualitySummary || {}),
        clickedPlaceId: null,
      });
      lastSearchSubmitTelemetryRef.current = {
        sessionId: searchSessionId,
        initialKind: searchExecutionKind,
        effectiveKind: pipelineIsBasic
          ? HOME_SEARCH_KIND.KEYWORD_SEARCH
          : HOME_SEARCH_KIND.AI_PARSE_SEARCH,
        fallbackTriggered: telemetryKeywordAiFallback,
        preFallbackResultCount: telemetryPreFallbackResultCount,
        finalResultCount,
        resultDelta,
        pipelineScreenRowCount: telemetryPipelineScreenRowCount,
        engineScoredPoolSize: telemetryEngineScoredPoolSize,
        ...(telemetryQualitySummary || {}),
      };
      const facetsForFeedback =
        naturalQ.facets || parseSearchQuery(nextQuery);
      const intentTagsForFeedback = intentTagsFromFacets(facetsForFeedback);
      const areaForFeedback =
        naturalQ.region ?? facetsForFeedback?.region ?? null;
      const searchLogId = await insertSearchLog({
        sessionId: searchSessionId,
        userQuery: nextQuery,
        parsed: facetsForFeedback,
        searchResultsIds: searchResultIdsForLog,
        hasResults: searchResultIdsForLog.length > 0,
        user,
        searchMode: searchModeForLog,
        hadClientError: searchHadError,
        submitUserVisibleCandidateCount: telemetryPipelineScreenRowCount,
        submitInitialSearchKind: searchExecutionKind,
        submitKeywordAiFallback: telemetryKeywordAiFallback,
      });
      lastSearchLogIdRef.current = searchLogId;
      searchFeedbackContextRef.current = {
        normalizedQuery: normalizedQueryForFeedback,
        area: areaForFeedback,
        intentTags: intentTagsForFeedback,
      };
      if (
        searchLogId &&
        Array.isArray(searchResultIdsForLog) &&
        searchResultIdsForLog.length > 0
      ) {
        const impressionKeys = [
          ...new Set(
            searchResultIdsForLog
              .map(placeKeyFromSearchLogResultId)
              .filter(Boolean)
          ),
        ];
        if (impressionKeys.length > 0) {
          void rpcIncrementSearchPlaceFeedbackImpressions({
            normalizedQuery: normalizedQueryForFeedback,
            area: areaForFeedback,
            intentTags: intentTagsForFeedback,
            placeKeys: impressionKeys,
          });
        }
      }
      const elapsed = Date.now() - searchUiStartedAt;
      if (elapsed < MIN_SEARCH_LOADING_MS && !skipMinSearchLoading) {
        await new Promise((r) =>
          setTimeout(r, MIN_SEARCH_LOADING_MS - elapsed)
        );
      }
      setIsAiSearching(false);
      setSearchLoadingLabel("");
      homeSearchSkipCoursePreviewRef.current = false;

      /** 키워드·AI 공통 — place_import_tmp 기반 `/recommend` 로 카드 한 줄(content reason) 확보 */
      let importRec = null;
      if (searchModeForLog !== "course" && String(nextQuery || "").trim()) {
        try {
          importRec = await fetchCuratorImportRecommend(nextQuery);
        } catch {
          /* /recommend 실패 시 extras.why 는 스코어·태그 템플릿 */
        }
      }

      const reopenSheetFromResultRefresh =
        forceReopenAiSheetAfterSearchRef.current &&
        searchResultIdsForLog.length > 0;
      const openAiSheetAfterThisSearch =
        shouldOpenAiSheetAfterLoad || reopenSheetFromResultRefresh;
      forceReopenAiSheetAfterSearchRef.current = false;

      if (openAiSheetAfterThisSearch) {
        if (
          searchModeForLog !== "course" &&
          !pipelineIsBasic &&
          String(nextQuery || "").trim()
        ) {
          const base = lastAiScoredPlacesForImportReorderRef.current;
          if (importRec?.ok && Array.isArray(base) && base.length > 0) {
            const importList =
              Array.isArray(importRec.import_pool) &&
              importRec.import_pool.length > 0
                ? importRec.import_pool
                : importRec.places;
            if (!Array.isArray(importList) || importList.length === 0) {
              /* skip reorder */
            } else {
              const ordered = orderPlacesByImportFirst(base, importList);
              if (ordered.length > 0) {
                setExternalPlaces(
                  ordered.map((p) => ({ ...p, isKakaoPlace: true })),
                );
                setExternalPlacesPool(
                  ordered.map((p) => ({ ...p, isKakaoPlace: true })),
                );
                setAiRecommendedIds(ordered.map((p) => p.id));
              }
            }
          }
        }
        setAiSheetOpen(true);
        setTimeout(() => mapRef.current?.relayout?.(), 100);
      }
      lastAiScoredPlacesForImportReorderRef.current = null;
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
      // 1) 큐레이터 username 우선 조회
      const { data: curatorData, error: curatorError } = await supabase
        .from('curators')
        .select('id, user_id, username, slug')
        .or(`slug.eq.${curatorName},username.eq.${curatorName}`)
        .maybeSingle();
      if (curatorError) {
        console.error('큐레이터 정보 조회 실패:', curatorError);
      }

      // 2) 큐레이터가 아니면 profiles.username으로 일반 유저 조회
      let targetUserId = String(curatorData?.user_id || "").trim();
      if (!targetUserId) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, username")
          .eq("username", curatorName)
          .maybeSingle();
        if (profileError) {
          console.error("일반 유저 정보 조회 실패:", profileError);
        }
        targetUserId = String(profileData?.id || "").trim();
      }

      if (!targetUserId) {
        showToast("사용자 정보를 찾을 수 없습니다.", "error", 3000);
        return;
      }
      if (targetUserId === user.id) {
        showToast('자기 자신은 팔로우할 수 없습니다.', 'error', 3000);
        return;
      }
      
      try {
        await followUser(supabase, targetUserId);
      } catch (followError) {
        console.error('팔로우 실패:', followError);
        const msg = String(followError?.message || '').toLowerCase();
        if (followError?.code === '23505' || msg.includes('duplicate')) {
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
        .or(`slug.eq.${curatorName},username.eq.${curatorName}`)
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
      const curatorPlaceIds = Array.from(
        new Set(
          (placesData || [])
            .map((row) => String(row?.place_id ?? "").trim())
            .filter(Boolean)
        )
      );

      let saveCount = 0;
      if (curatorPlaceIds.length > 0) {
        const { count: savedCountExact, error: savesError } = await supabase
          .from("user_saved_places")
          .select("place_id", { count: "exact", head: true })
          .in("place_id", curatorPlaceIds);
        if (!savesError) {
          saveCount = Number(savedCountExact) || 0;
        }
      }
      
      const { data: countRow, error: followersError } = await supabase.rpc(
        "user_follow_counts",
        { p_user_id: curatorData.user_id }
      );
      const fc = Array.isArray(countRow) ? countRow[0] : countRow;
      const followerCount = followersError
        ? 0
        : Number(fc?.followers_count) || 0;
      
      return {
        ...curatorData,
        placeCount,
        followerCount,
        saveCount,
      };
      
    } catch (error) {
      console.error("❌ 큐레이터 상세 정보 로드 실패:", error);
      return null;
    }
  };

  // 선택된 큐레이터 정보 업데이트
  useEffect(() => {
    if (
      selectedCurator &&
      selectedCurator.isCurator !== false &&
      !selectedCurator.placeCount
    ) {
      // 상세 정보가 없으면 가져오기
      const loadDetails = async () => {
        try {
          const details = await fetchCuratorDetails(
            selectedCurator.username || selectedCurator.name
          );
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
      const slug = String(
        selectedCurator.slug ||
          selectedCurator.username ||
          selectedCurator.name ||
          ""
      ).trim();
      const name = String(
        selectedCurator.name ||
          selectedCurator.display_name ||
          selectedCurator.displayName ||
          slug
      ).trim();
      return {
        username: slug,
        displayName: name,
        level:
          selectedCurator.level ??
          selectedCurator.grade_level ??
          selectedCurator.gradeLevel ??
          selectedCurator.tier ??
          selectedCurator.rank ??
          null,
        gradeRaw: selectedCurator.grade ?? null,
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
        gradeRaw: firstCurator.grade ?? null,
        saveCount: Number(firstCurator.saveCount) || 0,
        placeCount: Number(firstCurator.placeCount) || 0,
        followerCount: Number(firstCurator.followerCount) || 0,
        bio: "서울의 숨은 명소를 찾아다니는 큐레이터입니다. 주로 혼술하기 좋은 조용한 곳을 추천해요."
      };
    }
    
    // 큐레이터인 경우: 자기 자신 표시 (팔로우 불가)
    return {
      username: curatorProfile?.username || "nopokiller",
      displayName: curatorProfile?.displayName || "노포킬러",
      level: 2, // Local Curator
      gradeRaw: curatorProfile?.grade ?? null,
      saveCount: 0,
      placeCount: 0,
      followerCount: 0,
      bio: curatorProfile?.bio || "서울의 숨은 명소를 찾아다니는 큐레이터입니다. 주로 혼술하기 좋은 조용한 곳을 추천해요."
    };
  };

  const testCurator = getModalCurator();
  const isGeneralUserProfile = selectedCurator?.isCurator === false;
  const modalRoleLabel = isGeneralUserProfile ? "아는 사람 프로필" : "큐레이터 프로필";
  const modalBioText = isGeneralUserProfile
    ? testCurator.bio || "아는 사람 활동 미리보기"
    : testCurator.bio || "소개가 없습니다.";
  const resolveGradeMeta = (rawGrade, numericLevel, isGeneralUser) => {
    if (isGeneralUser) return { label: "New Drinker", emoji: "🌱" };
    const gRaw = String(rawGrade ?? "").trim().toLowerCase();
    const g = gRaw.replace(/[\s_-]+/g, "");
    if (
      ["top", "master", "vip", "pro", "4"].includes(g) ||
      g.includes("topcurator") ||
      g.includes("platinum") ||
      g.includes("diamond") ||
      g.includes("legend")
    ) {
      return { label: "Top Curator", emoji: "👑" };
    }
    if (
      ["trusted", "senior", "3"].includes(g) ||
      g.includes("trustedcurator") ||
      g.includes("gold")
    ) {
      return { label: "Trusted Curator", emoji: "🏆" };
    }
    if (
      ["local", "default", "2"].includes(g) ||
      g.includes("localcurator") ||
      g.includes("silver")
    ) {
      return { label: "Local Curator", emoji: "⭐" };
    }
    if (
      ["new", "starter", "1"].includes(g) ||
      g.includes("newdrinker") ||
      g.includes("bronze") ||
      g.includes("beginner")
    ) {
      return { label: "New Drinker", emoji: "🌱" };
    }
    const lv = Number(numericLevel);
    if (Number.isFinite(lv) && lv >= 4) return { label: "Top Curator", emoji: "👑" };
    if (Number.isFinite(lv) && lv >= 3) return { label: "Trusted Curator", emoji: "🏆" };
    if (Number.isFinite(lv) && lv >= 2) return { label: "Local Curator", emoji: "⭐" };
    return { label: "New Drinker", emoji: "🌱" };
  };
  const modalGradeMeta = resolveGradeMeta(
    testCurator.gradeRaw,
    testCurator.level,
    isGeneralUserProfile
  );

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

  const showDesktopSocialStack = viewportWidth >= 1180;

  return (
    <>
      {/* 실시간 Toast 알림 */}
      <AnimatedToast position="top-right" />

      <HomeDesktopSocialStack
        visible={showDesktopSocialStack}
        user={user}
        judoMode={judoMode}
        onOpenPlaceDetail={(place, source) =>
          setSelectedPlaceWithAnalytics(place, source)
        }
      />

      <HomeLoginPromptGate
        open={showLoginPrompt}
        feature={requiredFeature}
        onClose={closeLoginPrompt}
        onLoginRequest={() => signInWithProvider("google")}
      />

      <HomeFollowCuratorModal
        open={showFollowModal}
        onClose={() => setShowFollowModal(false)}
        roleLabel={modalRoleLabel}
        bioText={modalBioText}
        gradeMeta={modalGradeMeta}
        curator={testCurator}
        currentUserUsername={curatorProfile?.username}
        onFollow={(username) => handleFollow(username)}
      />

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
          rankingTop5={hotStripPlaceRows}
          risingCurators={risingCurators}
          placesOnMap={mapDisplayedPlacesWithLegend}
          mapRef={mapRef}
          user={user}
          judoMode={judoMode}
          onOpenMutualPlaceDetail={(place, source) =>
            setSelectedPlaceWithAnalytics(place, source)
          }
          onPickMutualUser={(row) => {
            const slug = String(row?.slug || row?.username || "").trim();
            if (!slug) return;
            const profileName = String(
              row?.name || row?.displayName || slug
            ).trim();
            setSelectedCurator({
              userId: String(row?.userId || "").trim() || undefined,
              name: profileName,
              slug,
              username: slug,
              displayName: profileName,
              avatar: String(row?.avatarUrl || "").trim() || undefined,
              isCurator: Boolean(row?.isCurator),
              followerCount: Number(row?.followerCount) || 0,
              saveCount: Number(row?.saveCount) || 0,
              placeCount: row?.isCurator ? undefined : 0,
              bio: row?.isCurator ? undefined : "아는 사람 프로필 미리보기",
            });
            setShowFollowModal(true);
          }}
          onMutualSearchOpenChange={setMutualSearchPanelOpen}
          hideWhenPreviewOpen={Boolean(selectedPlace) || aiSheetOpen}
          hideWhenSearchActive={
            Boolean(String(query || "").trim()) || isAiSearching
          }
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
          {!selectedPlace &&
          !String(query || "").trim() &&
          !isAiSearching &&
          !mutualSearchPanelOpen &&
          !hideSituationFolderStripForMapCourseUi ? (
            <>
              <div style={styles.drinksSituationStripWrapper}>
                <div
                  style={styles.drinksSituationStrip}
                  role="group"
                  aria-label="술 차례별 빠른 검색 한 번 실행 (코스 짜기 아님)"
                >
                  <button
                    type="button"
                    style={styles.drinksSituationChip}
                    onClick={() => {
                      void handleSearchSubmit(
                        DRINKS_SITUATION_CHIP_SINGLE_SHOT_QUERY[
                          SITUATION_FOLDER.firstMeal
                        ],
                        {
                          skipCourseRecommendation: true,
                          omitSearchBarText: true,
                          mapViewportChipSearch: true,
                          chipResultProfile: SITUATION_FOLDER.firstMeal,
                        }
                      );
                    }}
                  >
                    <span style={styles.drinksSituationEmoji} aria-hidden>
                      🥢
                    </span>
                    <span>1차로 배 채우기</span>
                  </button>
                  <button
                    type="button"
                    style={styles.drinksSituationChip}
                    onClick={() => {
                      void handleSearchSubmit(
                        DRINKS_SITUATION_CHIP_SINGLE_SHOT_QUERY[
                          SITUATION_FOLDER.secondRound
                        ],
                        {
                          skipCourseRecommendation: true,
                          omitSearchBarText: true,
                          mapViewportChipSearch: true,
                          chipResultProfile: SITUATION_FOLDER.secondRound,
                        }
                      );
                    }}
                  >
                    <span style={styles.drinksSituationEmoji} aria-hidden>
                      🍺
                    </span>
                    <span>2차 가기 좋은 곳</span>
                  </button>
                  <button
                    type="button"
                    style={styles.drinksSituationChip}
                    onClick={() => {
                      void handleSearchSubmit(
                        DRINKS_SITUATION_CHIP_SINGLE_SHOT_QUERY[
                          SITUATION_FOLDER.vibe
                        ],
                        {
                          skipCourseRecommendation: true,
                          omitSearchBarText: true,
                          mapViewportChipSearch: true,
                          chipResultProfile: SITUATION_FOLDER.vibe,
                        }
                      );
                    }}
                  >
                    <span style={styles.drinksSituationEmoji} aria-hidden>
                      🍷
                    </span>
                    <span>분위기 있게 한잔</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
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
            livePlaceIds={
              judoMode.isDayMode ? EMPTY_LIVE_PLACE_IDS : livePlaceIds
            }
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
            hotRankTopPlaceIds={
              judoMode.isDayMode ? null : hotRankTopPlaceIds
            }
            canShowLiveFlame={judoMode.canShowLiveFlame}
            onMapBackgroundClick={() =>
              setMarkerGuideMapCloseTick((t) => t + 1)
            }
            onMapBlankClick={handleMapBlankPick}
            preserveViewportOnPlacesChange={
              showMapSearchHereButton ||
              mapViewportSearchLock ||
              preserveMapViewportSituationChip ||
              (Boolean(String(query || "").trim()) &&
                kakaoTypingPreviewPlaces.length > 0)
            }
            skipKoreaBBoxForCuratorPins={
              !isCourseMode &&
              !showSavedOnly &&
              (selectedCurators.length > 0 || showAll)
            }
            situationFolderFilter={situationFolderFilter}
            courseOverlay={courseMapOverlay}
            courseOverlayFitBottomPaddingPx={courseMapFitBottomPaddingPx}
            onCourseOverlayDismiss={dismissCourseMapPath}
            arrivalWalkingOverlay={arrivalWalkingOverlay}
            arrivalWalkingOverlayFitBottomPaddingPx={courseMapFitBottomPaddingPx}
            onArrivalWalkingOverlayDismiss={dismissArrivalWalkingOverlay}
            courseSecondPickMode={courseSecondPickMode}
            regionBoundaryOverlay={regionBoundaryOverlay}
            regionBoundaryFitBottomPaddingPx={courseMapFitBottomPaddingPx}
            placesFitBoundsPadding={mapSearchPlacesFitPadding}
          />
          <RecommendationMapOverlay
            recommendation={
              !isCourseMode &&
              curatorImportRecommendation?.ok &&
              !aiSheetUsesDisplayedPlaces
                ? curatorImportRecommendation
                : null
            }
            loading={recommendFetchLoading}
            error={recommendFetchError}
            onOpenDetail={() => {
              const p = recommendHighlightedMapPlaces[0];
              if (p) setSelectedPlaceWithAnalytics(p, "recommend_overlay");
            }}
          />
          {String(query || "").trim() && !isCourseMode ? (
            <button
              type="button"
              onClick={() => fetchCuratorImportRecommend(query)}
              className="pointer-events-auto absolute bottom-[calc(108px+env(safe-area-inset-bottom,0px))] left-3 z-[125] rounded-full border border-amber-500/80 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-md"
            >
              추천
            </button>
          ) : null}
          <HomeRecommendOverlay
            isCourseMode={isCourseMode}
            recommendation={curatorImportRecommendation}
            onSelectPlace={handleRecommendPlaceFromList}
            aiSheetUsesDisplayedPlaces={aiSheetUsesDisplayedPlaces}
            selectedRecommendedPlace={selectedRecommendedPlace}
            matchedMapPlace={matchedMapPlace}
            mergedPlace={mergedRecommendDetailPlace}
            isSaved={recommendDetailIsSaved}
            canCheckIn={judoMode.canCheckIn}
            onRequestSave={(p) => setSaveTargetPlace(p)}
            recommendationBatchPlaces={
              curatorImportRecommendation?.ok
                ? curatorImportPlacesOrPool
                : null
            }
            searchQuery={
              (curatorImportRecommendation?.ok &&
                String(curatorImportRecommendation.query || "").trim()) ||
              String(query || "").trim()
            }
            importSummaryText={
              curatorImportRecommendation?.ok
                ? curatorImportRecommendation.summary
                : ""
            }
            onClose={closeRecommendedPlaceDetail}
            onViewOnMap={() => {
              const mapTarget = matchedMapPlace ?? selectedRecommendedPlace;
              if (!mapTarget) return;
              const w = resolvePlaceWgs84(mapTarget);
              if (w) {
                if (mapRef.current?.panToAbovePreview) {
                  mapRef.current.panToAbovePreview(w.lat, w.lng);
                } else {
                  mapRef.current?.moveToLocation?.(w.lat, w.lng);
                }
              }
              setSelectedPlaceWithAnalytics(mapTarget, "recommend_detail");
            }}
          />
          <HomeDustIntroOverlay
            visible={
              !selectedPlace &&
              !String(query || "").trim() &&
              !isAiSearching &&
              !homeDustIntroDismissed
            }
            onTapToAnswer={handleHomeDustIntroTapToAnswer}
            onAnimationEnd={handleHomeDustIntroAnimationEnd}
            styleMap={styles}
          />
          <HomeMapFloatingActions
            showSearchHere={showMapSearchHereButton}
            onSearchHere={() => {
              searchHereArmedRef.current = true;
              setShowMapSearchHereButton(false);
              setMapViewportSearchLock(true);
              showToast(
                "다음 검색은 지금 화면 안에서만 찾아요.",
                "info",
                2600,
              );
            }}
            showAddHalfStep={canAddHalfStepNow}
            onAddHalfStep={() => {
              void handleCourseIncludeHalfStepChange(true);
            }}
            halfStepDisabled={isLoadingCourse || isAiSearching}
            halfStepStyles={styles.courseAddHalfStepFloatingBtn}
          />
        </div>

        <CourseSecondFindModal
          open={courseSecondFindModalOpen}
          onCancel={cancelCourseSecondFindModal}
          onConfirm={confirmCourseSecondFindModal}
          confirmBusy={mapCourseFirstBusy}
          vibes={courseSecondFindVibes}
          onChangeVibes={setCourseSecondFindVibes}
          liquors={courseSecondFindLiquors}
          onChangeLiquors={setCourseSecondFindLiquors}
          anju={courseSecondFindAnju}
          onChangeAnju={setCourseSecondFindAnju}
          maxDistanceM={courseSecondFindMaxDistanceM}
          onChangeMaxDistanceM={setCourseSecondFindMaxDistanceM}
          preferCloser={courseSecondFindPreferCloser}
          onChangePreferCloser={setCourseSecondFindPreferCloser}
          prioritizeCurators={courseSecondFindPrioritizeCurators}
          onChangePrioritizeCurators={setCourseSecondFindPrioritizeCurators}
        />

        <div style={styles.headerOverlay}>
          <div style={styles.headerTopRow}>
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

            <HomeCuratorFilterRow
              wrapperStyle={styles.filterWrapper}
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
                setSelectedCurator(curator);
                setShowFollowModal(true);
              }}
            />
          </div>

        </div>

        {judoMode.isDayMode ? (
          <div
            style={styles.judoDayNoticeFixedBar}
            role="status"
            aria-live="polite"
            title={dayModeNoticeText}
          >
            {dayModeNoticeText}
          </div>
        ) : null}

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
          <HomeMapLegendBar
            mapCloseTick={markerGuideMapCloseTick}
            savedOnly={showSavedOnly}
            onToggleSavedOnly={() => {
              setShowSavedOnly((prev) => {
                const next = !prev;
                if (next && selectedPlace) {
                  const savedKeySet = buildMergedSavedPlaceKeySet(
                    savedMap,
                    userSavedPlaces,
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
            onRequestMyLocation={() => mapRef.current?.requestMyLocation?.()}
            mapLocationLoading={mapLocationLoading}
            myLocationButtonStyle={styles.legendMyLocationButton}
            myLocationSpinnerStyle={styles.legendMyLocationSpinner}
          />
        </div>

        {!selectedPlace && !mutualSearchPanelOpen ? (
          <div style={styles.bottomBarContainer}>
            <div style={styles.searchWrapper}>
              <HomeSearchAboveStrip
                idleHintVisible={searchIdleHintVisible}
                idleHintText={searchIdleHintText}
                idleHintStyle={styles.searchIdleFloatingHint}
                showSpotlight={
                  !query.trim() && !isAiSearching && !mutualSearchPanelOpen
                }
                spotlightPlaces={curatorSpotlightPlaces}
                onPickSpotlightPlace={(place) => {
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
                placeholder={homeSearchPlaceholderText}
                onUserInteractWithSearch={dismissSearchIdleHint}
                searchInputRef={homeSearchInputRef}
                isLoading={isAiSearching}
                loadingStatusText={searchLoadingLabel}
                mapRef={mapRef}
                compactRightActions={compactSearchBarAuth}
                showKakaoSearch={true}
                onKakaoPlaceSelect={handleKakaoPlaceSelect}
                onKakaoTypingPreviewPlacesChange={setKakaoTypingPreviewPlaces}
                searchTargetMode={searchTargetMode}
                onSearchTargetModeChange={setSearchTargetMode}
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
                  <HomeSearchAuthSlot
                    authLoading={authLoading}
                    isLoggedIn={Boolean(user)}
                    userRole={getUserRole()}
                    compact={compactSearchBarAuth}
                    profileButtonHint={getProfileButtonHint()}
                    profilePhotoUrl={searchBarProfilePhotoUrl}
                    profilePhotoFailed={searchBarProfileImgFailed}
                    onProfilePhotoError={() => setSearchBarProfileImgFailed(true)}
                    profileInitial={getSearchBarProfileInitial()}
                    onProfileClick={() => {
                      const userRole = getUserRole();
                      console.log(" @아이디 버튼 클릭:", {
                        userRole,
                        isAdmin,
                        isCurator,
                        username: getDisplayUsername(),
                      });
                      if (userRole === "admin") {
                        navigate("/admin");
                      } else if (userRole === "curator") {
                        navigate("/studio");
                      } else {
                        setShowUserCard(true);
                      }
                    }}
                    onSignOut={() => {
                      signOut().catch((error) => {
                        console.error("signOut error:", error);
                        alert(error?.message || "로그아웃에 실패했습니다.");
                      });
                    }}
                    onGoogleLogin={() => {
                      signInWithProvider("google").catch((error) => {
                        console.error("google login error:", error);
                        alert(error?.message || "구글 로그인에 실패했습니다.");
                      });
                    }}
                    onKakaoLogin={() => {
                      signInWithProvider("kakao").catch((error) => {
                        console.error("kakao login error:", error);
                        alert(error?.message || "카카오 로그인에 실패했습니다.");
                      });
                    }}
                    styleMap={styles}
                  />
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
                  /** 접힘: 지도 넓게(170). 펼침: 핫스트립(360)보다 위 — 떠오르는 큐레이터가 코스 시트를 가리지 않게 */
                  zIndex: aiSheetOpen ? 380 : 170,
                }
              : aiSheetOpen ||
                  (aiRecommendedIds.length > 0 &&
                    String(query || "").trim() &&
                    !simpleMapSearchMarkersOnly)
                ? {
                    /** 핫스트립(360)·검색바 래퍼(160)보다 위 — 맞춤 바텀시트·피크가 가리지 않게 */
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
                canCheckIn={judoMode.canCheckIn}
                savedFolderColor={
                  previewSavedState.folderColor ??
                  savedColorMap[selectedPlace.id]
                }
                selectedCurators={selectedCurators}
                onSavedToSupabase={loadUserSavedPlaces}
                onClose={() => setSelectedPlace(null)}
                getUserRole={getUserRole}
                searchSessionIdRef={searchSessionIdRef}
                searchFeedbackContextRef={searchFeedbackContextRef}
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
            <HomeCourseMergedSheet
              styles={styles}
              isCourseMode={isCourseMode}
              courseMergedHeaderRef={courseMergedHeaderRef}
              handleClearSearch={handleClearSearch}
              courseHasFinalTwoSteps={courseHasFinalTwoSteps}
              handleResetCoursePickWithSavePrompt={handleResetCoursePickWithSavePrompt}
              aiSheetOpen={aiSheetOpen}
              setAiSheetOpen={setAiSheetOpen}
              isAiSearching={isAiSearching}
              courseError={courseError}
              courseOptions={courseOptions}
              aiSummary={aiSummary}
              coursePullStripRef={coursePullStripRef}
              courseSearchUsedGpsOrigin={courseSearchUsedGpsOrigin}
              courseGpsRadiusM={courseGpsRadiusM}
              handleCourseGpsRadiusChange={handleCourseGpsRadiusChange}
              isLoadingCourse={isLoadingCourse}
              courseQueryParsed={courseQueryParsed}
              courseIncludeHalfStep={courseIncludeHalfStep}
              handleCourseIncludeHalfStepChange={handleCourseIncludeHalfStepChange}
              courseSwipeRowRef={courseSwipeRowRef}
              onCourseSwipeRowScroll={onCourseSwipeRowScroll}
              selectedCourse={selectedCourse}
              chooseCourse={chooseCourse}
              setCourseComposeSlotFirst={setCourseComposeSlotFirst}
              setCourseComposeSlotBridge={setCourseComposeSlotBridge}
              setCourseComposeSlotSecond={setCourseComposeSlotSecond}
              courseComposeSlotFirst={courseComposeSlotFirst}
              courseComposeSlotBridge={courseComposeSlotBridge}
              courseComposeSlotSecond={courseComposeSlotSecond}
              curatorPlaceCatalogForMerge={curatorPlaceCatalogForMerge}
              setSelectedPlaceWithAnalytics={setSelectedPlaceWithAnalytics}
              assignCourseStepToComposeAuto={assignCourseStepToComposeAuto}
              courseWalkStrollHint={courseWalkStrollHint}
              courseDrivingMap={courseDrivingMap}
              applyComposedCourseFromSteps={applyComposedCourseFromSteps}
              altFirstCourses={altFirstCourses}
              altSecondCourses={altSecondCourses}
              applyAlternativeFirst={applyAlternativeFirst}
              applyAlternativeSecond={applyAlternativeSecond}
              rerunDifferentCourses={rerunDifferentCourses}
              regenerateSelectedCourseFirst={regenerateSelectedCourseFirst}
              regenerateSelectedCourseSecond={regenerateSelectedCourseSecond}
              isRefreshingCourses={isRefreshingCourses}
              isRegeneratingSecond={isRegeneratingSecond}
              isRegeneratingFirst={isRegeneratingFirst}
            />

          ) : (aiRecommendedIds.length > 0 || useImportRecPlacesForAiSheet) &&
            !simpleMapSearchMarkersOnly ? (
            <HomeAiBottomSheetCluster
              styles={styles}
              aiSheetOpen={aiSheetOpen}
              setAiSheetOpen={setAiSheetOpen}
              isAiSearching={isAiSearching}
              displayedPlaces={displayedPlaces}
              setKakaoPlaces={setKakaoPlaces}
              preserveMapViewportSituationChip={preserveMapViewportSituationChip}
              setMapSearchMarkerFitTick={setMapSearchMarkerFitTick}
              aiError={aiError}
              aiBottomSheetPlaces={aiBottomSheetPlaces}
              loadingDots={loadingDots}
              searchLoadingLabel={searchLoadingLabel}
              aiSummary={aiSummary}
              yajangFallbackBanner={yajangFallbackBanner}
              aiSheetPage={aiSheetPage}
              setAiSheetPage={setAiSheetPage}
              aiSheetTotalPages={aiSheetTotalPages}
              aiSheetPageSize={AI_SHEET_PAGE_SIZE}
              aiBottomSheetPagedPlaces={aiBottomSheetPagedPlaces}
              getRecommendationListDistanceLabel={getRecommendationListDistanceLabel}
              searchResultSheetExtras={searchResultSheetExtras}
              curatorImportRecommendation={curatorImportRecommendation}
              curatorImportPlacesOrPool={curatorImportPlacesOrPool}
              query={query}
              useImportRecPlacesForAiSheet={useImportRecPlacesForAiSheet}
              handleRecommendPlaceFromList={handleRecommendPlaceFromList}
              setSelectedPlaceWithAnalytics={setSelectedPlaceWithAnalytics}
              mapRef={mapRef}
              topReasonMap={topReasonMap}
              aiSheetPlacePreviewKey={aiSheetPlacePreviewKey}
              aiSheetPhotoByKey={aiSheetPhotoByKey}
              aiSheetExpandedReasonByKey={aiSheetExpandedReasonByKey}
              setAiSheetExpandedReasonByKey={setAiSheetExpandedReasonByKey}
              aiSheetPhotoViewerSuppressOpenUntilRef={aiSheetPhotoViewerSuppressOpenUntilRef}
              aiSheetPhotoViewerItems={aiSheetPhotoViewerItems}
              aiSheetPhotoViewerIndex={aiSheetPhotoViewerIndex}
              setAiSheetPhotoViewerIndex={setAiSheetPhotoViewerIndex}
              setAiSheetPhotoViewerOpen={setAiSheetPhotoViewerOpen}
              curatorSearchHighlightList={curatorSearchHighlightList}
              setShowAll={setShowAll}
              setSelectedCurators={setSelectedCurators}
              dbCurators={dbCurators}
              blogReviews={blogReviews}
              aiSheetPhotoViewerOpen={aiSheetPhotoViewerOpen}
              closeAiSheetPhotoViewer={closeAiSheetPhotoViewer}
            />

          ) : null}
        </div>
      </main>


      <HomeBottomModalStack
        user={user}
        savedPlacesOpen={savedPlacesOpen}
        folders={folders}
        savedPlacesByFolder={savedPlacesByFolder}
        onCloseSavedPlaces={() => setSavedPlacesOpen(false)}
        getUserRole={getUserRole}
        addPlaceOpen={addPlaceOpen}
        curators={dbCurators}
        onCloseAddPlace={() => setAddPlaceOpen(false)}
        onAddPlaceAdded={refreshCustomPlaces}
        saveTargetPlace={saveTargetPlace}
        savedFolderIds={
          saveTargetPlace ? getPlaceFolderIds(saveTargetPlace.id) : []
        }
        onCloseSaveFolder={() => {
          setSaveTargetPlace(null);
          loadUserSavedPlaces();
        }}
        onFoldersUpdated={() => {
          refreshStorage();
          loadUserSavedPlaces();
        }}
        onSaveToFolder={(pId, fId) => {
          savePlaceToFolder(pId, fId);
          refreshStorage();
        }}
        showUserCard={showUserCard}
        onCloseUserCard={() => setShowUserCard(false)}
        onPublicProfileSaved={refreshMapUserProfile}
      />

    </div>
      </>
  );
}

