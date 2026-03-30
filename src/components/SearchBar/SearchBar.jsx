import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

export default function SearchBar({
  query,
  setQuery,
  onSubmit,
  onClear,
  onExampleClick,
  suggestions = [],
  placeholder = "검색어를 입력해 주세요",
  isLoading = false,
  rightActions = null,
  mapRef = null, // 카카오 지도 ref 추가
  showKakaoSearch = true, // 카카오 검색 표시 여부
  onKakaoPlaceSelect = null, // 카카오 장소 선택 콜백
}) {
  const visibleSuggestions = Array.isArray(suggestions)
    ? suggestions.slice(0, 3)
    : [];

  // 카카오 장소 검색 관련 상태
  const [kakaoResults, setKakaoResults] = useState([]);
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [showKakaoResults, setShowKakaoResults] = useState(false);
  const [selectedKakaoIndex, setSelectedKakaoIndex] = useState(-1); // 키보드 내비게이션을 위한 선택된 인덱스
  const searchTimeoutRef = useRef(null);

  // 카카오 장소 검색
  const searchKakaoPlaces = (keyword) => {
    if (!keyword.trim() || !window.kakao?.maps?.services) {
      setKakaoResults([]);
      setSelectedKakaoIndex(-1); // 결과가 없으면 선택된 인덱스 초기화
      return;
    }

    setIsKakaoLoading(true);
    setSelectedKakaoIndex(-1); // 새로운 검색 시작 시 선택된 인덱스 초기화

    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch(
      keyword,
      (data, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          setKakaoResults(data);
          setShowKakaoResults(true);
        } else {
          setKakaoResults([]);
          setSelectedKakaoIndex(-1); // 결과가 없으면 선택된 인덱스 초기화
        }
        setIsKakaoLoading(false);
      },
      {
        category_group_code: 'FD6', // 음식점
        // location: mapRef?.current?.getCenter(), // 임시로 주석 처리
        radius: 5000
      }
    );
  };

  // 디바운스 검색
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    // 검색어가 변경되면 선택된 인덱스 초기화
    setSelectedKakaoIndex(-1);

    if (showKakaoSearch) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        searchKakaoPlaces(value);
      }, 300);
    }
  };

  // 카카오 장소 선택
  const handleKakaoPlaceSelect = (place) => {
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
      onSubmit(query);
      setShowSuggestions(false);
      setShowKakaoResults(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      
      // 카카오 검색 결과가 표시되고 선택된 항목이 있으면 해당 장소 선택
      if (showKakaoResults && kakaoResults.length > 0 && selectedKakaoIndex >= 0) {
        const selectedPlace = kakaoResults[selectedKakaoIndex];
        handleKakaoPlaceSelect(selectedPlace);
      } else {
        // 일반 검색 실행
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
      setShowKakaoResults(false);
      setSelectedKakaoIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery("");
    setKakaoResults([]);
    setShowKakaoResults(false);
    setSelectedKakaoIndex(-1); // 초기화 추가
    onClear?.();
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <section style={{ ...styles.section, position: 'relative' }}>
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
            {kakaoResults.map((place, index) => (
              <motion.button
                key={place.id}
                type="button"
                onClick={() => handleKakaoPlaceSelect(place)}
                style={{
                  ...styles.suggestionItem,
                  textAlign: 'left',
                  padding: '12px',
                  backgroundColor: selectedKakaoIndex === index ? '#2c3e50' : 'transparent',
                  border: selectedKakaoIndex === index ? '1px solid #3498db' : '1px solid transparent',
                  cursor: 'pointer'
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                whileHover={{ backgroundColor: '#34495e', x: 5 }}
                whileTap={{ scale: 0.98 }}
              >
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '4px'
              }}>
                {place.place_name}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#999',
                marginBottom: '2px'
              }}>
                {place.road_address_name || place.address_name}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>{place.category_name}</span>
                {place.distance && <span>• {Math.round(place.distance)}m</span>}
              </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={styles.searchWrap}>
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

        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <motion.input
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder=""  // placeholder 비우기
            onFocus={() => showKakaoSearch && setShowKakaoResults(true)}
            style={{
              ...styles.input,
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
              {placeholder}
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
          <div style={styles.rightActions}>{rightActions}</div>
        ) : null}
      </div>

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
  },

  searchWrap: {
    height: "50px",
    border: "1px solid rgba(255,255,255,0.08)",
    backgroundColor: "rgba(18, 19, 18, 0.94)",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
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
  },

  inputWithRightActions: {
    paddingRight: "100px",
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
    gap: "8px",
    flexShrink: 0,
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