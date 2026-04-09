/**
 * 주도 검색바: 채팅 UI가 아니라 자연어 1줄 → 파싱·지도 후보·스코어·확장 제안.
 * 최종 형태·구현 매핑: `src/utils/searchPhase8SearchBar.js`
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SearchStates, { InitialState, TypingState, SearchCompleteState } from "./SearchStates";
import { supabase } from '../../lib/supabase';
import ContextTags from './ContextTags';
import { formatKakaoKeywordHitsForMap } from "../../utils/formatKakaoKeywordHitsForMap";
import {
  filterKakaoKeywordRowsForMealIntent,
  isMealFocusedKakaoQuery,
} from "../../utils/filterKakaoKeywordResultsForMealIntent";

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
  matchedContexts = [],
  onContextTagClick = null,
  onKakaoPlaceSelect = null,
  showKakaoSearch = true,
  onRealTimeSearch = null,
  userLocation = null,
  onNearbySearch = null,
  onNearbyPlacesFound = null,
  rightActions = null,
  /** 좁은 화면에서 검색 입력 폭 확보 (우측 버튼 간격 축소) */
  compactRightActions = false,
  mapRef = null,
  placeholder = 'Search for places...',
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
  const [thinkDots, setThinkDots] = useState(".");

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
  const [appliedFilters, setAppliedFilters] = useState([]); // 적용된 필터 칩

  // 카카오 장소 검색
  const searchKakaoPlaces = (keyword) => {
    if (!keyword.trim() || !window.kakao?.maps?.services) {
      setKakaoResults([]);
      setSelectedKakaoIndex(-1); // 결과가 없으면 선택된 인덱스 초기화
      return;
    }

    const token = ++kakaoSearchTokenRef.current;
    setIsKakaoLoading(true);
    setSelectedKakaoIndex(-1); // 새로운 검색 시작 시 선택된 인덱스 초기화

    const ps = new window.kakao.maps.services.Places();

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
      if (c && typeof c.getLat === "function") {
        const lat = c.getLat();
        const lng = c.getLng();
        if (Number.isFinite(lat) && Number.isFinite(lng)) origin = { lat, lng };
      }
    }

    const mealFocusedQuery = isMealFocusedKakaoQuery(keyword);
    const searchOptions = {
      category_group_code: "FD6",
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
        if (status === window.kakao.maps.services.Status.OK) {
          let rows = data;
          if (origin) {
            rows = data
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
            rows = data.map((place) => {
              const d = Number(place.distance);
              if (!Number.isFinite(d) || d <= 0) {
                const { distance: _drop, ...rest } = place;
                return rest;
              }
              return place;
            });
          }
          rows = filterKakaoKeywordRowsForMealIntent(keyword, rows);
          rows = rows.slice(0, 15);
          setKakaoResults(rows);
          setShowKakaoResultsState(true);
        } else {
          setKakaoResults([]);
          setShowKakaoResultsState(false);
        }
        setIsKakaoLoading(false);
      },
      searchOptions
    );
  };

  // 디바운스 검색
  const handleInputChange = (e) => {
    const value = e.target.value;
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
    // 지도 이동 처리
    console.log('장소 선택 (지도 이동):', place);
    
    // mapRef를 통해 지도 이동 (moveToLocation 함수 사용)
    if (mapRef?.current?.moveToLocation) {
      mapRef.current.moveToLocation(place.y, place.x);
      console.log('지도 이동 완료:', place.y, place.x);
    } else {
      console.log('moveToLocation 함수 없음');
    }

    // 콜백 함수 호출 (마커 생성 및 카드 표시)
    if (onKakaoPlaceSelect) {
      onKakaoPlaceSelect(place);
    }

    // 검색 결과 닫기 및 선택된 인덱스 초기화
    setShowKakaoResults(false);
    setSelectedKakaoIndex(-1);
    setQuery('');
  };

  const handleSubmit = () => {
    if (query.trim()) {
      cancelPendingKakaoSearch();
      setIsSearching(true); // 검색 상태로 변경
      
      onSubmit(query);
      
      // 필터 칩 생성 (검색어 분석)
      const filters = [];
      if (query.includes('뒷풀이') || query.includes('회식')) {
        filters.push({ icon: '🎉', label: '뒷풀이', type: 'context' });
      }
      if (query.includes('데이트') || query.includes('연인')) {
        filters.push({ icon: '💕', label: '데이트', type: 'context' });
      }
      if (query.includes('혼술') || query.includes('혼자')) {
        filters.push({ icon: '🍶', label: '혼술', type: 'context' });
      }
      if (query.includes('해장') || query.includes('숙취')) {
        filters.push({ icon: '💊', label: '해장', type: 'context' });
      }
      
      setAppliedFilters(filters);
      
      // 검색 실행 후 모든 자동완성 UI 숨김
      setShowSuggestions(false);
      setShowKakaoResults(false);
      setSelectedKakaoIndex(-1);
      
      // 검색 완료 후 상태 복원 (시뮬레이션)
      setTimeout(() => {
        setIsSearching(false);
        setQuery(''); // 검색창 비우기
      }, 1000);
    }
  };

  // 상황 태그 클릭 핸들러
  const handleContextTagClick = (contextKey, contextName) => {
    console.log(`🏷️ 상황 태그 클릭: ${contextKey} - ${contextName}`);
    
    // 상황별 추천 검색어 생성
    const contextQueries = {
      after_party: '강남역 뒷풀이 술집',
      date: '홍대 데이트 맛집',
      hangover: '해장 맛집',
      solo: '혼술하기 좋은 곳',
      group: '대규모 단체 모임 장소',
      must_go: '인생 맛집',
      terrace: '루프탑 바'
    };

    const searchQuery = contextQueries[contextKey] || contextName;
    setQuery(searchQuery);

    cancelPendingKakaoSearch();

    // 태그 클릭 시 즉시 검색 실행
    onSubmit(searchQuery);
    
    // 모든 자동완성 UI 숨김
    setShowSuggestions(false);
    setShowKakaoResults(false);
    setSelectedKakaoIndex(-1);
    
    // 부모 컴포넌트에 알림
    if (onContextTagClick) {
      onContextTagClick(contextKey, contextName);
    }
  };

  const handleKeyDown = (event) => {
    // 키보드 네비게이션 기능 복원
    if (event.key === "Enter") {
      event.preventDefault();
      console.log('🔑 Enter 키 감지!'); // 디버깅용

      cancelPendingKakaoSearch();

      // 엔터키 시 모든 자동완성 카드 즉시 숨김
      setShowSuggestions(false);
      setShowKakaoResultsState(false);
      setSelectedKakaoIndex(-1);
      
      // 카카오 검색 결과가 표시되고 선택된 항목이 있으면 해당 장소 선택
      if (showKakaoResults && kakaoResults.length > 0 && selectedKakaoIndex >= 0) {
        const selectedPlace = kakaoResults[selectedKakaoIndex];
        handleKakaoPlaceSelect(selectedPlace);
      } else {
        // 일반 AI 검색 실행 - 지도에 마커만 표시
        handleSubmit();
      }
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
      setShowKakaoResults(false);
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

  return (
    <section style={{ ...styles.section, position: 'relative' }}>
      {/* 상태별 UI 렌더링 */}
      <AnimatePresence>
        {/* 입력 중 상태: 자동완성 + 상황 태그 */}
        {showSuggestions && (
          <TypingState
            query={query}
            kakaoResults={kakaoResults}
            isKakaoLoading={isKakaoLoading}
            showKakaoResults={showKakaoResults}
            selectedKakaoIndex={selectedKakaoIndex}
            setSelectedKakaoIndex={setSelectedKakaoIndex}
            onKakaoPlaceClick={handleKakaoPlaceSelect}
            matchedContexts={matchedContexts}
            onContextTagClick={handleContextTagClick}
            userLocation={userLocation}
            onNearbySearch={handleNearbySearch}
          />
        )}

        {/* 검색 후 상태: 필터 칩 */}
        {!query && !isSearching && appliedFilters.length > 0 && (
          <SearchCompleteState
            appliedFilters={appliedFilters}
            onFilterRemove={(index) => {
              setAppliedFilters(prev => prev.filter((_, i) => i !== index));
            }}
          />
        )}
      </AnimatePresence>
      
      {/* 카카오 장소 검색 결과 - 위쪽으로 표시 */}
      <AnimatePresence>
        {showKakaoSearch && showKakaoResults && kakaoResults.length > 0 && (
          <motion.div
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
              타이핑 · 카카오 음식점 이름 매칭 — 지도에 후보 전부 표시됨 · 엔터는 전체 검색
            </div>
            {kakaoResults.map((place, index) => (
              <motion.button
                key={place.id}
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
            transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
          >
            {isLoading ? "🔄" : "🔎"}
          </motion.span>
        </motion.button>

        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <motion.input
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder=""  // placeholder 비우기
            title="타이핑 시 위 목록은 가게 이름 제안(카카오). 엔터는 입력한 문장으로 주도 전체 검색."
            onFocus={() => showKakaoSearch && setShowKakaoResults(true)}
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
          
          {/* 전광판 효과 - placeholder 글씨 움직임 */}
          {!query && (
            <motion.div
              style={{
                position: 'absolute',
                top: '25%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                fontWeight: 'normal',
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center'
              }}
              animate={{ x: ['100%', '-100%'] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'linear',
                repeatDelay: 0
              }}
            >
              {placeholder || 'Search for places...'}
            </motion.div>
          )}
        </div>

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

      {/* 바깥 클릭 시 카카오 결과 닫기 */}
      {showKakaoSearch && showKakaoResults && (
        <div
          onClick={() => setShowKakaoResults(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        />
      )}
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
    padding: "0 4px 2px",
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