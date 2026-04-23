/**
 * 주도 검색바: 채팅 UI가 아니라 자연어 1줄 → 파싱·지도 후보·스코어·확장 제안.
 * 최종 형태·구현 매핑: `src/utils/searchPhase8SearchBar.js`
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TypingState } from "./SearchStates";
import { supabase } from '../../lib/supabase';
import { formatKakaoKeywordHitsForMap } from "../../utils/formatKakaoKeywordHitsForMap";
import {
  filterKakaoKeywordRowsForMealIntent,
  isMealFocusedKakaoQuery,
} from "../../utils/filterKakaoKeywordResultsForMealIntent";
import { searchKakaoKeywordViaProxy } from "../../utils/kakaoAPIProxy";

/** 왼쪽 검색 방식 버튼 순환: 자동 → 빠른(카카오) → AI 고정 */
const SEARCH_CHANNEL_ORDER = ["auto", "basic", "ai"];

/** 카카오 자동완성·주변 검색 공통 — 미터 */
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000);
}

export default function SearchBar({
  query,
  setQuery,
  onSubmit,
  onClear,
  onExampleClick,
  isLoading = false,
  suggestions = [],
  showSuggestions = false,
  setShowSuggestions = () => {},
  onKakaoPlaceSelect = null,
  showKakaoSearch = true,
  onRealTimeSearch = null,
  userLocation = null,
  onNearbySearch = null,
  onNearbyPlacesFound = null,
  rightActions = null,
  /** 좁은 화면에서 검색 입력 폭 확보 (우측 버튼 간격 축소) */
  compactRightActions = false,
  /** Home 등: 왼쪽 아이콘 — auto(자동) ↔ basic(빠름) ↔ ai(고정) 순환 + 안내 말풍선 */
  showChannelTabs = false,
  searchChannel = "auto",
  onSearchChannelChange = null,
  mapRef = null,
  placeholder = 'Search for places...',
  /** 홈 등: 입력·포커스 시 보조 플로팅 힌트 닫기 */
  onUserInteractWithSearch = null,
  /** 검색 중 하단 GPT 스타일 상태 문구 */
  loadingStatusText = "",
  /** 타이핑 자동완성 후보를 지도 마커로 올릴 때 부모에 전달 (빈 배열이면 제거) */
  onKakaoTypingPreviewPlacesChange = null,
}) {
  const visibleSuggestions = Array.isArray(suggestions)
    ? suggestions.slice(0, 3)
    : [];

  // 카카오 장소 검색 관련 상태
  const [kakaoResults, setKakaoResults] = useState([]);
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [showKakaoResults, setShowKakaoResultsState] = useState(false);
  const [selectedKakaoIndex, setSelectedKakaoIndex] = useState(-1); // 키보드 내비게이션을 위한 선택된 인덱스
  const searchTimeoutRef = useRef(null);
  /** 카카오 키워드 검색 디바운스 (AI 실시간 검색 타이머와 분리) */
  const kakaoSearchDebounceRef = useRef(null);
  /** Enter/제출 후 늦게 도착하는 카카오 콜백이 바텀시트를 다시 열지 않게 함 */
  const kakaoSearchTokenRef = useRef(0);
  const kakaoResultsScrollRef = useRef(null);
  /** 카카오 목록 + 검색줄 루트 — 전체화면 백드롭 없이 바깥 탭으로 닫기 */
  const searchRootRef = useRef(null);
  const channelModeWrapRef = useRef(null);
  const [thinkDots, setThinkDots] = useState(".");
  /** 장소/주도 전환 시 짧은 설명 말풍선 */
  const [channelPopoverOpen, setChannelPopoverOpen] = useState(false);
  const channelPopoverCloseTimerRef = useRef(null);
  const firstAiTipTimerRef = useRef(null);
  const [showFirstAiSearchTip, setShowFirstAiSearchTip] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setThinkDots(".");
      return;
    }
    const id = setInterval(() => {
      setThinkDots((d) => (d === "." ? ".." : d === ".." ? "..." : "."));
    }, 420);
    return () => clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (channelPopoverCloseTimerRef.current) {
        clearTimeout(channelPopoverCloseTimerRef.current);
        channelPopoverCloseTimerRef.current = null;
      }
    };
  }, []);

  /** 검색 방식 말풍선: 바깥 탭으로 닫기 */
  useEffect(() => {
    if (!channelPopoverOpen) return undefined;
    const onDocPointerDown = (e) => {
      const w = channelModeWrapRef.current;
      if (!w || !(e.target instanceof Node)) return;
      if (!w.contains(e.target)) setChannelPopoverOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [channelPopoverOpen]);

  /** 전체화면 fixed 백드롭 대신: 지도 팬·드래그는 통과, 검색 블록 밖 탭이면 목록만 닫음 */
  useEffect(() => {
    if (!showKakaoSearch || !showKakaoResults || !kakaoResults.length) {
      return undefined;
    }
    const onDocPointerDown = (e) => {
      const root = searchRootRef.current;
      if (!root || !(e.target instanceof Node)) return;
      if (!root.contains(e.target)) {
        setShowKakaoResultsState(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [showKakaoSearch, showKakaoResults, kakaoResults.length]);

  const cancelPendingKakaoSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    if (kakaoSearchDebounceRef.current) {
      clearTimeout(kakaoSearchDebounceRef.current);
      kakaoSearchDebounceRef.current = null;
    }
    kakaoSearchTokenRef.current += 1;
  };

  // 주변 검색 관련 상태
  const [nearbyResults, setNearbyResults] = useState([]);
  const [isNearbyMode, setIsNearbyMode] = useState(false);

  // UI 상태 관리
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // 카카오 장소 검색 — JS SDK 우선, 없거나 0건이면 REST 프록시(/api/kakao/search)
  const searchKakaoPlaces = (keyword) => {
    if (!keyword.trim()) {
      setKakaoResults([]);
      setSelectedKakaoIndex(-1);
      setShowKakaoResultsState(false);
      setIsKakaoLoading(false);
      return;
    }

    const token = ++kakaoSearchTokenRef.current;
    setIsKakaoLoading(true);
    setSelectedKakaoIndex(-1);

    let origin = null;
    if (
      userLocation?.lat != null &&
      userLocation?.lng != null &&
      Number.isFinite(Number(userLocation.lat)) &&
      Number.isFinite(Number(userLocation.lng))
    ) {
      origin = { lat: Number(userLocation.lat), lng: Number(userLocation.lng) };
    } else {
      const c = mapRef?.current?.getCenter?.();
      if (c && typeof c === "object") {
        const lat =
          typeof c.getLat === "function" ? c.getLat() : Number(c.lat);
        const lng =
          typeof c.getLng === "function" ? c.getLng() : Number(c.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          origin = { lat, lng };
        }
      }
    }

    const mealFocusedQuery = isMealFocusedKakaoQuery(keyword);

    const processRawRows = (raw) => {
      let rows = Array.isArray(raw) ? raw : [];
      if (origin) {
        rows = rows
          .map((place) => {
            const plat = parseFloat(place.y);
            const plng = parseFloat(place.x);
            const dist =
              Number.isFinite(plat) && Number.isFinite(plng)
                ? haversineDistanceMeters(
                    origin.lat,
                    origin.lng,
                    plat,
                    plng
                  )
                : null;
            return dist != null ? { ...place, distance: dist } : place;
          })
          .sort(
            (a, b) =>
              (Number(a.distance) || 1e12) - (Number(b.distance) || 1e12)
          );
      } else {
        rows = rows.map((place) => {
          const d = Number(place.distance);
          if (!Number.isFinite(d) || d <= 0) {
            const { distance: _drop, ...rest } = place;
            return rest;
          }
          return place;
        });
      }
      rows = filterKakaoKeywordRowsForMealIntent(keyword, rows);
      return rows.slice(0, 15);
    };

    const finishWithRows = (raw) => {
      if (token !== kakaoSearchTokenRef.current) {
        setIsKakaoLoading(false);
        return;
      }
      const rows = processRawRows(raw);
      if (rows.length > 0) {
        setKakaoResults(rows);
        setShowKakaoResultsState(true);
      } else {
        setKakaoResults([]);
        setShowKakaoResultsState(false);
      }
      setIsKakaoLoading(false);
    };

    const fetchViaProxy = async () => {
      try {
        const { documents } = await searchKakaoKeywordViaProxy({
          query: keyword,
          size: 15,
          ...(origin
            ? {
                x: origin.lng,
                y: origin.lat,
                radius: 20000,
              }
            : {}),
        });
        finishWithRows(documents);
      } catch (e) {
        console.warn("searchKakaoKeywordViaProxy:", e);
        finishWithRows([]);
      }
    };

    if (!window.kakao?.maps?.services) {
      void fetchViaProxy();
      return;
    }

    const ps = new window.kakao.maps.services.Places();
    const searchOptions = {
      ...(mealFocusedQuery ? { category_group_code: "FD6" } : {}),
      size: mealFocusedQuery ? 30 : 15,
      ...(origin
        ? {
            location: new window.kakao.maps.LatLng(origin.lat, origin.lng),
            radius: 20000,
            sort: window.kakao.maps.services.SortBy.DISTANCE,
          }
        : {}),
    };

    ps.keywordSearch(
      keyword,
      (data, status) => {
        if (token !== kakaoSearchTokenRef.current) {
          setIsKakaoLoading(false);
          return;
        }
        const ok =
          status === window.kakao.maps.services.Status.OK &&
          Array.isArray(data) &&
          data.length > 0;
        if (ok) {
          finishWithRows(data);
          return;
        }
        void fetchViaProxy();
      },
      searchOptions
    );
  };

  // 디바운스 검색
  const handleInputChange = (e) => {
    const value = e.target.value;
    onUserInteractWithSearch?.();
    setQuery(value);
    
    // 검색어가 변경되면 선택된 인덱스 초기화
    setSelectedKakaoIndex(-1);

    // 실시간 AI 검색
    if (onRealTimeSearch) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        onRealTimeSearch(value);
      }, 500); // 500ms 디바운스
    }

    if (showKakaoSearch) {
      if (kakaoSearchDebounceRef.current) {
        clearTimeout(kakaoSearchDebounceRef.current);
      }
      kakaoSearchDebounceRef.current = setTimeout(() => {
        kakaoSearchDebounceRef.current = null;
        searchKakaoPlaces(value);
      }, 300);
    }
  };

  // 카카오 장소 선택
  const handleKakaoPlaceSelect = (place) => {
    cancelPendingKakaoSearch();

    /** 지도 중심·패닝은 부모/MapView(미리보기 카드 높이 보정)에서 처리 — 여기 setCenter가 pan 보정을 덮어쓰지 않게 */

    onKakaoPlaceSelect?.(place);

    // 검색 결과 닫기 및 선택된 인덱스 초기화
    setShowKakaoResultsState(false);
    setSelectedKakaoIndex(-1);
    setQuery('');
  };

  const handleSubmit = () => {
    if (query.trim()) {
      cancelPendingKakaoSearch();
      setIsSearching(true); // 검색 상태로 변경
      
      onSubmit(query);

      // 검색 실행 후 모든 자동완성 UI 숨김
      setShowSuggestions(false);
      setShowKakaoResultsState(false);
      setSelectedKakaoIndex(-1);
      setIsSearching(false);
    }
  };

  const handleKeyDown = (event) => {
    // 키보드 네비게이션 기능 복원
    if (event.key === "Enter") {
      if (event.nativeEvent?.isComposing) return;
      event.preventDefault();

      cancelPendingKakaoSearch();

      // 장소 자동완성이 열려 있어도, 화살표로 항목을 고르기 전엔 엔터 = 입력 그대로 상위 검색(코스·문장 등).
      // 예전: 무조건 첫 POI 확정 → `onSubmit`이 안 불려 «검색어를 못 듣는» 것처럼 보임.
      if (
        showKakaoResults &&
        kakaoResults.length > 0 &&
        selectedKakaoIndex >= 0
      ) {
        const idx = Math.min(selectedKakaoIndex, kakaoResults.length - 1);
        handleKakaoPlaceSelect(kakaoResults[idx]);
        return;
      }

      setShowSuggestions(false);
      setShowKakaoResultsState(false);
      setSelectedKakaoIndex(-1);
      handleSubmit();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      
      if (showKakaoResults && kakaoResults.length > 0) {
        // 아래 화살표: 다음 항목 선택
        const newIndex = Math.min(selectedKakaoIndex + 1, kakaoResults.length - 1);
        setSelectedKakaoIndex(newIndex);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      
      if (showKakaoResults && kakaoResults.length > 0) {
        // 위 화살표: 이전 항목 선택
        const newIndex = Math.max(selectedKakaoIndex - 1, -1);
        setSelectedKakaoIndex(newIndex);
      }
    } else if (event.key === "Escape") {
      // ESC 키: 검색 결과 닫기
      setShowKakaoResultsState(false);
      setSelectedKakaoIndex(-1);
    }
  };

  const handleClear = () => {
    cancelPendingKakaoSearch();
    setQuery("");
    setKakaoResults([]);
    setShowKakaoResultsState(false);
    setSelectedKakaoIndex(-1); // 초기화 추가
    onClear?.();
  };

  useLayoutEffect(() => {
    if (selectedKakaoIndex < 0) return;
    if (!showKakaoSearch || !showKakaoResults || kakaoResults.length === 0) {
      return;
    }
    const root = kakaoResultsScrollRef.current;
    if (!root) return;
    const item = root.querySelector(
      `[data-kakao-suggestion-index="${selectedKakaoIndex}"]`
    );
    item?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }, [
    selectedKakaoIndex,
    showKakaoResults,
    showKakaoSearch,
    kakaoResults.length,
  ]);

  // 타이핑 자동완성 → 지도 후보 동기화
  useEffect(() => {
    if (typeof onKakaoTypingPreviewPlacesChange !== "function") return;
    if (!showKakaoSearch || !showKakaoResults || kakaoResults.length === 0) {
      onKakaoTypingPreviewPlacesChange([]);
      return;
    }
    onKakaoTypingPreviewPlacesChange(formatKakaoKeywordHitsForMap(kakaoResults));
  }, [
    kakaoResults,
    showKakaoResults,
    showKakaoSearch,
    onKakaoTypingPreviewPlacesChange,
  ]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (kakaoSearchDebounceRef.current) {
        clearTimeout(kakaoSearchDebounceRef.current);
      }
    };
  }, []);

  const calculateDistance = haversineDistanceMeters;

  // 주변 술집 검색 함수 (블로그 필터링 포함)
  const searchNearbyBars = async (location) => {
    if (!window.kakao?.maps?.services || !location) {
      console.log('❌ searchNearbyBars: 조건 불만족', { hasLocation: !!location });
      return;
    }

    console.log('🔍 주변 술집 대량 검색 시작:', location);
    setIsKakaoLoading(true);

    const ps = new window.kakao.maps.services.Places();
    
    // 다양한 키워드로 검색해서 결과 합치기
    const searchKeywords = ['술집', 'bar', 'pub', 'izakaya', 'wine', 'beer', '호프', '요리주점', '포장마차', '야키토리'];
    const searchPromises = [];

    searchKeywords.forEach(keyword => {
      const promise = new Promise((resolve) => {
        const searchOptions = {
          category_group_code: 'FD6',
          radius: 3000, // 3km
          sort: window.kakao.maps.services.SortBy.DISTANCE,
          location: new window.kakao.maps.LatLng(location.lat, location.lng),
          size: 15,
        };

        ps.keywordSearch(
          keyword,
          (data, status) => {
            if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
              const resultsWithDistance = data.map(place => ({
                ...place,
                distance: calculateDistance(
                  location.lat, location.lng,
                  parseFloat(place.y), parseFloat(place.x)
                ),
                searchKeyword: keyword
              }));
              resolve(resultsWithDistance);
            } else {
              resolve([]);
            }
          },
          searchOptions
        );
      });
      searchPromises.push(promise);
    });

    // 모든 검색 결과 수집
    const resultsArray = await Promise.all(searchPromises);
    
    // 결과 통합 및 중복 제거
    let combinedResults = [];
    resultsArray.forEach(results => {
      combinedResults = [...combinedResults, ...results];
    });

    const uniqueResults = [];
    const seen = new Set();
    combinedResults.forEach(place => {
      const key = `${place.place_name}|${place.address_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(place);
      }
    });

    // 거리순 정렬
    uniqueResults.sort((a, b) => a.distance - b.distance);
    console.log('📍 통합 검색 결과:', uniqueResults.length, '개 (중복제거)');

    // 블로그 기반 필터링 API 호출 (최대 30개만)
    console.log('🔍 블로그 기반 필터링 시작...');
    
    try {
      const response = await fetch('/api/nearby-with-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          places: uniqueResults.slice(0, 30),
          userQuery: '주변 술집',
          location: location.address || ''
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.places.length > 0) {
          console.log(`✅ 블로그 필터링 완료: ${data.filteredCount}개 추천`);
          setNearbyResults(data.places);
          setIsNearbyMode(true);
          // 부모 컴포넌트에 필터링된 결과 전달
          if (onKakaoPlaceSelect) {
            // 여러 장소를 한번에 표시
            data.places.forEach(place => onKakaoPlaceSelect(place));
          }
        } else {
          console.log('⚠️ 블로그 필터링 결과 없음, 원본 결과 사용');
          setNearbyResults(uniqueResults);
          setIsNearbyMode(true);
          if (onKakaoPlaceSelect) {
            uniqueResults.forEach(place => onKakaoPlaceSelect(place));
          }
        }
      } else {
        setNearbyResults(uniqueResults);
        setIsNearbyMode(true);
        if (onKakaoPlaceSelect) {
          uniqueResults.forEach(place => onKakaoPlaceSelect(place));
        }
      }
    } catch (error) {
      console.error('❌ 블로그 필터링 API 오류:', error);
      setNearbyResults(uniqueResults);
      setIsNearbyMode(true);
      if (onKakaoPlaceSelect) {
        uniqueResults.forEach(place => onKakaoPlaceSelect(place));
      }
    } finally {
      setIsKakaoLoading(false);
      setKakaoResults([]);
      setShowKakaoResultsState(false);
    }
  };

  const handleNearbySearch = async () => {
    console.log('SearchBar: handleNearbySearch called');
    
    if (!userLocation) {
      // If no user location, try to get current location
      if (!navigator.geolocation) {
        alert("This browser doesn't support location services.");
        return;
      }

      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          });
        });

        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Current Location'
        };

        console.log('SearchBar: Got current location:', location);
        
        // Call nearby search with current location
        if (onNearbySearch) {
          onNearbySearch(location);
        }
      } catch (error) {
        console.error('SearchBar: Location error:', error);
        
        let errorMsg = "Unable to get your location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Location permission denied. Please enable location in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMsg = "Location request timed out.";
            break;
        }
        alert(errorMsg);
      }
    } else {
      // Use existing user location
      console.log('SearchBar: Using existing location:', userLocation);
      if (onNearbySearch) {
        onNearbySearch(userLocation);
      }
    }
  };

  const useChannelToggle =
    showChannelTabs && typeof onSearchChannelChange === "function";

  const FIRST_AI_TIP_KEY = "judo_first_ai_search_tip_v1";
  const FIRST_AI_TIP_DELAY_MS = 1150;
  const FIRST_AI_TIP_VISIBLE_MS = 5200;

  const dismissFirstAiSearchTip = useCallback(() => {
    if (firstAiTipTimerRef.current) {
      clearTimeout(firstAiTipTimerRef.current);
      firstAiTipTimerRef.current = null;
    }
    setShowFirstAiSearchTip(false);
    try {
      localStorage.setItem(FIRST_AI_TIP_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!useChannelToggle) return undefined;
    // 기본이 자동 맞춤이면 옛 «AI로 전환» 팁은 끔
    if (searchChannel === "auto") return undefined;
    try {
      if (localStorage.getItem(FIRST_AI_TIP_KEY)) return undefined;
    } catch {
      /* ignore */
    }
    firstAiTipTimerRef.current = setTimeout(() => {
      firstAiTipTimerRef.current = null;
      setShowFirstAiSearchTip(true);
    }, FIRST_AI_TIP_DELAY_MS);
    return () => {
      if (firstAiTipTimerRef.current) {
        clearTimeout(firstAiTipTimerRef.current);
        firstAiTipTimerRef.current = null;
      }
    };
  }, [useChannelToggle, searchChannel]);

  useEffect(() => {
    if (!showFirstAiSearchTip) return undefined;
    const t = setTimeout(() => {
      dismissFirstAiSearchTip();
    }, FIRST_AI_TIP_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [showFirstAiSearchTip, dismissFirstAiSearchTip]);

  const scheduleChannelPopoverClose = () => {
    if (channelPopoverCloseTimerRef.current) {
      clearTimeout(channelPopoverCloseTimerRef.current);
    }
    channelPopoverCloseTimerRef.current = setTimeout(() => {
      setChannelPopoverOpen(false);
      channelPopoverCloseTimerRef.current = null;
    }, 4000);
  };

  const toggleSearchChannel = () => {
    dismissFirstAiSearchTip();
    if (!onSearchChannelChange || isLoading) return;
    const i = SEARCH_CHANNEL_ORDER.indexOf(searchChannel);
    const next =
      SEARCH_CHANNEL_ORDER[
        i >= 0 ? (i + 1) % SEARCH_CHANNEL_ORDER.length : 0
      ];
    onSearchChannelChange(next);
    setChannelPopoverOpen(true);
    scheduleChannelPopoverClose();
  };

  return (
    <section ref={searchRootRef} style={{ ...styles.section, position: "relative" }}>
      {/* 상태별 UI 렌더링 */}
      <AnimatePresence>
        {/* 입력 중 상태: 자동완성 등 */}
        {showSuggestions && (
          <TypingState
            query={query}
            kakaoResults={kakaoResults}
            isKakaoLoading={isKakaoLoading}
            showKakaoResults={showKakaoResults}
            selectedKakaoIndex={selectedKakaoIndex}
            setSelectedKakaoIndex={setSelectedKakaoIndex}
            onKakaoPlaceClick={handleKakaoPlaceSelect}
            userLocation={userLocation}
            onNearbySearch={handleNearbySearch}
          />
        )}
      </AnimatePresence>

      {/* 카카오 장소 검색 결과 - 위쪽으로 표시 */}
      <AnimatePresence>
        {showKakaoSearch && showKakaoResults && kakaoResults.length > 0 && (
          <motion.div
            ref={kakaoResultsScrollRef}
            style={{
              ...styles.suggestionBox,
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              maxHeight: '300px',
              overflowY: 'auto',
              marginBottom: '8px',
              zIndex: 1000
            }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: "9px",
                color: "rgba(255,255,255,0.48)",
                lineHeight: 1.35,
                flexShrink: 0,
              }}
            >
              {searchChannel === "basic"
                ? "타이핑 · 카카오 장소 매칭 — 지도에 후보 표시 · 엔터는 카카오 검색(빠른 모드)"
                : searchChannel === "ai"
                  ? "타이핑 · 카카오 음식점 이름 매칭 — 지도에 후보 표시 · 엔터는 AI 주도 통합 검색"
                  : "타이핑 · 카카오 후보 표시 · 엔터는 문장·키워드에 맞춰 자동으로 빠른 검색 또는 의도 보조 검색"}
            </div>
            {kakaoResults.map((place, index) => (
              <motion.button
                key={place.id != null ? String(place.id) : `idx-${index}`}
                data-kakao-suggestion-index={index}
                type="button"
                onClick={() => handleKakaoPlaceSelect(place)}
                style={{
                  ...styles.suggestionItem,
                  textAlign: 'left',
                  padding: '8px 10px',
                  backgroundColor: selectedKakaoIndex === index ? '#2c3e50' : 'transparent',
                  border: selectedKakaoIndex === index ? '1px solid #3498db' : '1px solid transparent',
                  cursor: 'pointer',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                whileHover={{ backgroundColor: '#34495e', x: 5 }}
                whileTap={{ scale: 0.98 }}
              >
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                }}
              >
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#fff',
                  marginBottom: '2px',
                  lineHeight: 1.3,
                }}>
                  {place.place_name}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#999',
                  lineHeight: 1.3,
                }}>
                  {place.road_address_name || place.address_name}
                </div>
              </div>
              {Number.isFinite(Number(place.distance)) ? (
                <div style={{
                  fontSize: '9px',
                  color: '#888',
                  lineHeight: 1.3,
                  flexShrink: 0,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}>
                  {Math.round(Number(place.distance))}m
                </div>
              ) : null}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        ...styles.searchWrap,
        borderRadius: showKakaoResults ? "16px 16px 0 0" : "16px" // 바텀시트 있을 때만 상단 각지게
      }}>
        <style>{`
          .judoSearchBarInput::placeholder {
            color: rgba(255, 255, 255, 0.42);
            opacity: 1;
          }
        `}</style>
        {useChannelToggle ? (
          <div
            ref={channelModeWrapRef}
            style={{ position: "relative", flexShrink: 0 }}
          >
            <AnimatePresence>
              {showFirstAiSearchTip ? (
                <motion.div
                  key="first-ai-search-tip"
                  role="status"
                  aria-live="polite"
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 10px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: "200px",
                    maxWidth: "min(90vw, 280px)",
                    padding: "11px 13px 12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(134, 239, 172, 0.35)",
                    background: "rgba(15, 28, 18, 0.98)",
                    boxShadow:
                      "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset",
                    backdropFilter: "blur(10px)",
                    zIndex: 1002,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#86efac",
                      marginBottom: "6px",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    빠른 검색만 쓰는 중이에요
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      lineHeight: 1.5,
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    왼쪽을 한 번 더 누르면 자동 맞춤으로 돌아가요. 엔터 한 번으로
                    문장·키워드를 감지해 주도가 파이프라인을 고릅니다.
                  </div>
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: "-7px",
                      marginLeft: "-7px",
                      width: 0,
                      height: 0,
                      borderLeft: "7px solid transparent",
                      borderRight: "7px solid transparent",
                      borderTop: "7px solid rgba(15, 28, 18, 0.98)",
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {channelPopoverOpen && !showFirstAiSearchTip ? (
                <motion.div
                  key="channel-pop"
                  role="tooltip"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.16 }}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 10px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: "196px",
                    maxWidth: "min(92vw, 280px)",
                    padding: "10px 12px 11px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(22, 24, 22, 0.97)",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.38)",
                    backdropFilter: "blur(10px)",
                    zIndex: 1001,
                    pointerEvents: "auto",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#e8f7ec",
                      marginBottom: "5px",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {searchChannel === "basic"
                      ? "장소 검색"
                      : searchChannel === "ai"
                        ? "AI 주도 검색"
                        : "자동 맞춤"}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      lineHeight: 1.45,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {searchChannel === "basic"
                      ? "다음: 자동 맞춤. 지금은 카카오 키워드로 빠르게 찾습니다."
                      : searchChannel === "ai"
                        ? "다음: 자동 맞춤. 지금은 문장·의도 보조와 통합 검색을 씁니다."
                        : "다음: 장소 검색(빠름). 엔터 한 번으로 키워드·문장을 감지해 파이프라인을 고릅니다."}
                  </div>
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: "-7px",
                      marginLeft: "-7px",
                      width: 0,
                      height: 0,
                      borderLeft: "7px solid transparent",
                      borderRight: "7px solid transparent",
                      borderTop: "7px solid rgba(22, 24, 22, 0.97)",
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
            <motion.button
              type="button"
              onClick={toggleSearchChannel}
              style={styles.channelModeButton}
              aria-label={
                searchChannel === "basic"
                  ? "검색 방식: 장소 검색(빠름). 다음은 자동 맞춤."
                  : searchChannel === "ai"
                    ? "검색 방식: AI 주도 검색. 다음은 자동 맞춤."
                    : "검색 방식: 자동 맞춤. 다음은 장소 검색(빠름)."
              }
              title={
                searchChannel === "basic"
                  ? "다음: 자동 맞춤"
                  : searchChannel === "ai"
                    ? "다음: 자동 맞춤"
                    : "다음: 장소 검색(빠름)"
              }
              disabled={isLoading}
              animate={
                showFirstAiSearchTip && !isLoading
                  ? { y: [0, -6, 0, -5, 0] }
                  : { y: 0 }
              }
              transition={
                showFirstAiSearchTip && !isLoading
                  ? {
                      repeat: Infinity,
                      duration: 0.72,
                      ease: "easeInOut",
                    }
                  : { duration: 0.2 }
              }
              whileTap={{ scale: 0.9 }}
              whileHover={
                showFirstAiSearchTip && !isLoading ? false : { scale: 1.03 }
              }
            >
              <span style={{ fontSize: "15px", lineHeight: 1 }} aria-hidden>
                {searchChannel === "basic"
                  ? "🔎"
                  : searchChannel === "ai"
                    ? "✨"
                    : "🧭"}
              </span>
            </motion.button>
          </div>
        ) : (
          <motion.button
            type="button"
            onClick={handleSubmit}
            style={styles.iconButton}
            aria-label="검색"
            disabled={isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.span
              style={styles.icon}
              animate={{ rotate: isLoading ? 360 : 0 }}
              transition={{
                duration: 1,
                repeat: isLoading ? Infinity : 0,
                ease: "linear",
              }}
            >
              {isLoading ? "🔄" : "🔎"}
            </motion.span>
          </motion.button>
        )}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
          <motion.input
            className="judoSearchBarInput"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            enterKeyHint={useChannelToggle ? "search" : undefined}
            placeholder={placeholder || "Search for places..."}
            title={
              searchChannel === "basic"
                ? "타이핑 시 카카오 장소 제안. 엔터는 카카오 키워드 검색(빠른 모드)."
                : searchChannel === "ai"
                  ? "타이핑 시 위 목록은 가게 이름 제안(카카오). 엔터는 입력한 문장으로 AI 주도 통합 검색."
                  : "타이핑 시 카카오 후보 표시. 엔터는 가게명·짧은 키워드는 빠른 검색, 문장·조건은 의도 보조 검색으로 자동 전환."
            }
            onFocus={() => {
              onUserInteractWithSearch?.();
              if (!showKakaoSearch) return;
              // 포커스만으로 showKakaoResults를 켜면 결과가 없을 때도 전체 화면 백드롭이 올라가 지도 터치 드래그가 막힘(모바일)
              if (kakaoResults.length > 0) setShowKakaoResultsState(true);
            }}
            style={{
              ...styles.input,
              width: "100%",
              minWidth: 0,
              ...(rightActions ? styles.inputWithRightActions : {}),
            }}
            disabled={isLoading}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
          </div>
        </div>

        {useChannelToggle && query.trim() ? (
          <motion.button
            type="button"
            onClick={handleSubmit}
            style={styles.inlineSubmitButton}
            aria-label="검색 실행"
            disabled={isLoading}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.04 }}
          >
            <motion.span
              style={styles.icon}
              animate={{ rotate: isLoading ? 360 : 0 }}
              transition={{
                duration: 1,
                repeat: isLoading ? Infinity : 0,
                ease: "linear",
              }}
            >
              {isLoading ? "🔄" : "🔎"}
            </motion.span>
          </motion.button>
        ) : null}

        {query ? (
          <motion.button
            type="button"
            onClick={handleClear}
            style={styles.clearButton}
            aria-label="검색어 지우기"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            ✕
          </motion.button>
        ) : null}

        {rightActions ? (
          <div
            style={{
              ...styles.rightActions,
              ...(compactRightActions ? styles.rightActionsNarrow : {}),
            }}
          >
            {rightActions}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div
          style={styles.thinkingRow}
          role="status"
          aria-live="polite"
        >
          <motion.span
            style={styles.thinkingDot}
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.88, 1.06, 0.88] }}
            transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          <span style={styles.thinkingText}>
            {loadingStatusText || "검색하는 중"}
            {thinkDots}
          </span>
        </div>
      ) : null}

      {query.trim() && visibleSuggestions.length > 0 ? (
        <div style={styles.suggestionBox}>
          {visibleSuggestions.map((item) => (
            <button
              key={`${item.type}-${item.label}`}
              type="button"
              onClick={() => {
                const nextValue = item.actualName || item.label;
                setQuery(nextValue);
                onSubmit?.(nextValue);
              }}
              style={styles.suggestionItem}
            >
              <span style={styles.suggestionType}>{item.type}</span>
              <span style={styles.suggestionLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}

    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    minWidth: 0,
  },

  thinkingRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
    padding: "0 12px 2px",
    minHeight: "20px",
  },
  thinkingDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "rgba(46, 204, 113, 0.95)",
    flexShrink: 0,
    boxShadow: "0 0 10px rgba(46, 204, 113, 0.45)",
    display: "inline-block",
  },
  thinkingText: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
  },

  searchWrap: {
    height: "50px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18, 19, 18, 0.94)",
    borderRadius: "0 0 16px 16px", // 하단만 둥글게, 상단은 각지게
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  },

  iconButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  /** 돋보기 자리: 장소↔주도 전환 (작은 정사각 터치 타깃) */
  channelModeButton: {
    width: "34px",
    height: "34px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  },

  /** 모드 분리 시: 모바일용 실행 돋보기 (입력 옆 소형) */
  inlineSubmitButton: {
    width: "30px",
    height: "30px",
    border: "none",
    borderRadius: "999px",
    backgroundColor: "rgba(46, 204, 113, 0.16)",
    color: "#ffffff",
    fontSize: "12px",
    flexShrink: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
  },

  icon: {
    fontSize: "14px",
    opacity: 0.9,
    flexShrink: 0,
    color: "#ffffff",
  },

  input: {
    flex: 1,
    height: "100%",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "#ffffff", 
    fontSize: "14px",
    textDecoration: "none", // 밑줄 제거
  },

  inputWithRightActions: {
    paddingRight: "6px",
  },

  clearButton: {
    width: "28px",
    height: "28px",
    border: "none",
    borderRadius: "999px",
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
    fontSize: "12px",
    flexShrink: 0,
    cursor: "pointer",
  },

  rightActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
    flexWrap: "nowrap",
  },

  rightActionsNarrow: {
    gap: "4px",
  },

  exampleRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "8px",
  },

  exampleChip: {
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18,18,18,0.92)",
    color: "#ffffff",
    borderRadius: "999px",
    padding: "7px 10px",
    fontSize: "11px",
    fontWeight: 600,
    backdropFilter: "blur(8px)",
    cursor: "pointer",
  },

  suggestionBox: {
    marginTop: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(17,17,17,0.96)",
    borderRadius: "16px",
    overflow: "hidden",
    backdropFilter: "blur(10px)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.28)",
  },

  suggestionItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    backgroundColor: "transparent",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    textAlign: "left",
    cursor: "pointer",
  },

  suggestionType: {
    fontSize: "11px",
    color: "#9f9f9f",
    flexShrink: 0,
  },

  suggestionLabel: {
    fontSize: "13px",
    color: "#ffffff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};