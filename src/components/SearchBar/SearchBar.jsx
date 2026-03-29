import { useState, useEffect, useRef } from 'react';
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
}) {
  const visibleSuggestions = Array.isArray(suggestions)
    ? suggestions.slice(0, 3)
    : [];

  // 카카오 장소 검색 관련 상태
  const [kakaoResults, setKakaoResults] = useState([]);
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [showKakaoResults, setShowKakaoResults] = useState(false);
  const searchTimeoutRef = useRef(null);

  // 카카오 장소 검색
  const searchKakaoPlaces = (keyword) => {
    if (!keyword.trim() || !window.kakao?.maps?.services) {
      setKakaoResults([]);
      return;
    }

    setIsKakaoLoading(true);

    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch(
      keyword,
      (data, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          setKakaoResults(data);
          setShowKakaoResults(true);
        } else {
          setKakaoResults([]);
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
    // 지도 이동 - 임시로 console.log만
    console.log('장소 선택 (지도 이동 필요):', place);
    
    // TODO: MapView에 panTo 기능 추가 필요
    // if (mapRef?.current) {
    //   const moveLatLon = new window.kakao.maps.LatLng(place.y, place.x);
    //   mapRef.current.panTo(moveLatLon);
    // }

    // Supabase에 저장
    savePlaceToDatabase(place);

    // 검색 결과 닫기
    setShowKakaoResults(false);
    setQuery('');
  };

  // Supabase 저장
  const savePlaceToDatabase = async (place) => {
    try {
      const { data: existingPlace } = await supabase
        .from('places')
        .select('id')
        .eq('kakao_place_id', place.id)
        .single();

      if (!existingPlace) {
        await supabase
          .from('places')
          .upsert({
            kakao_place_id: place.id,
            name: place.place_name,
            address: place.road_address_name || place.address_name,
            category: place.category_name,
            x: parseFloat(place.x),
            y: parseFloat(place.y),
            phone: place.phone,
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('장소 저장 오류:', error);
    }
  };

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    
    // AI 검색 대신 카카오 장소 검색만 사용
    if (showKakaoSearch) {
      searchKakaoPlaces(trimmed);
    }
    onSubmit?.(trimmed);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setQuery("");
    setKakaoResults([]);
    setShowKakaoResults(false);
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
      {showKakaoSearch && showKakaoResults && kakaoResults.length > 0 && (
        <div style={{
          ...styles.suggestionBox,
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          maxHeight: '300px',
          overflowY: 'auto',
          marginBottom: '8px',
          zIndex: 1000
        }}>
          {kakaoResults.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => handleKakaoPlaceSelect(place)}
              style={{
                ...styles.suggestionItem,
                textAlign: 'left',
                padding: '12px'
              }}
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
            </button>
          ))}
        </div>
      )}

      <div style={styles.searchWrap}>
        <button
          type="button"
          onClick={handleSubmit}
          style={styles.iconButton}
          aria-label="검색"
          disabled={isLoading}
        >
          <span style={styles.icon}>{isLoading ? "…" : "🔎"}</span>
        </button>

        <input
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          onFocus={() => showKakaoSearch && setShowKakaoResults(true)}
          style={{
            ...styles.input,
            ...(rightActions ? styles.inputWithRightActions : {}),
          }}
          disabled={isLoading}
        />

        {query ? (
          <button
            type="button"
            onClick={handleClear}
            style={styles.clearButton}
            aria-label="검색어 지우기"
          >
            ✕
          </button>
        ) : null}

        {rightActions ? (
          <div style={styles.rightActions}>{rightActions}</div>
        ) : null}
      </div>

      {!query.trim() ? (
        <div style={styles.exampleRow}>
          {/* <button
            type="button"
            onClick={() => onExampleClick?.("을지로 조용한 노포 2차")}
            style={styles.exampleChip}
          >
            을지로 조용한 노포 2차
          </button> */}
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
    paddingRight: "120px",
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