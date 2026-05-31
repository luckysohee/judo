import { useLayoutEffect, useRef } from 'react';
import './scrollbar.css'; // 동글 스크롤바 스타일 import

// 입력 전 상태: 아무것도 표시 안 함
const InitialState = () => null;

// 입력 중 상태: 자동완성 등
function TypingState({
  query,
  kakaoResults,
  isKakaoLoading,
  showKakaoResults,
  selectedKakaoIndex,
  setSelectedKakaoIndex,
  onKakaoPlaceClick,
  userLocation,
  onNearbySearch,
}) {
  const kakaoScrollRef = useRef(null);
  useLayoutEffect(() => {
    if (selectedKakaoIndex < 0 || !kakaoResults?.length) return;
    const root = kakaoScrollRef.current;
    if (!root) return;
    const item = root.querySelector(
      `[data-kakao-suggestion-index="${selectedKakaoIndex}"]`
    );
    item?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }, [selectedKakaoIndex, kakaoResults?.length]);

  return (
  <div className="absolute top-full left-0 right-0 mt-2 z-40">
    {/* nearby search button */}
    {userLocation && onNearbySearch && (
      <div
        style={{
          marginBottom: '8px',
          padding: '0 16px'
        }}
      >
        <button
          onClick={onNearbySearch}
          disabled={isKakaoLoading}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: isKakaoLoading ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.1)',
            border: isKakaoLoading ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            color: isKakaoLoading ? 'rgba(147, 197, 253, 0.5)' : '#93c5fd',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isKakaoLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (!isKakaoLoading) {
              e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
              e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isKakaoLoading) {
              e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
              e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            }
          }}
        >
          {isKakaoLoading ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(147, 197, 253, 0.3)',
                borderTopColor: '#93c5fd',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span>searching nearby...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
              <span>my location</span>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>nearby bars</span>
            </>
          )}
        </button>
      </div>
    )}

    {/* location suggestion when no userLocation */}
    {!userLocation && (
      <div
        style={{
          marginBottom: '8px',
          padding: '0 16px'
        }}
      >
        <div
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: '#999',
            fontSize: '13px',
            textAlign: 'center',
            backdropFilter: 'blur(20px)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '4px' }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <div>enable location to find nearby bars</div>
        </div>
      </div>
    )}

    {/* 장소명 자동완성 - 플로팅 한줄씩 (반응형) */}
    {kakaoResults.length > 0 && (
      <div
        ref={kakaoScrollRef}
        id="search-results-sheet"
        className="search-results-container"
        style={{
          position: 'absolute !important',
          top: '100% !important',
          left: '12px !important', // 검색바 패딩과 맞춤
          right: '12px !important', // 화면 너비에 맞게 자동 조절
          zIndex: '9999 !important',
          padding: '8px 4px 8px 0', // 오른쪽에 스크롤바 공간
          maxHeight: '33vh', // 화면 높이에 맞게 자동 조절
          overflowY: 'auto', // 세로 스크롤
          pointerEvents: 'none',
          // 동글 스크롤바 스타일
          scrollbarWidth: 'thin !important', // Firefox
          scrollbarColor: 'rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1) !important', // Firefox
        }}
      >
        <div
          style={{
            padding: "4px 10px 6px",
            fontSize: "9px",
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.35,
            pointerEvents: "none",
          }}
        >
          가게 이름 제안(카카오) — 엔터는 전체 검색
        </div>
        {/* 장소 리스트 - 플로팅 한줄씩 */}
        {kakaoResults.map((place, index) => (
          <div
            key={place.id != null ? String(place.id) : `idx-${index}`}
            data-kakao-suggestion-index={index}
            style={{
              position: 'relative',
              width: '100%',
              background: selectedKakaoIndex === index 
                ? 'rgba(59, 130, 246, 0.2)' 
                : 'rgba(18, 18, 18, 0.7)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: selectedKakaoIndex === index 
                ? '2px solid rgba(59, 130, 246, 0.8)' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '6px 10px',
              marginBottom: index < kakaoResults.length - 1 ? '4px' : '0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: selectedKakaoIndex === index ? '0 2px 8px rgba(59, 130, 246, 0.3)' : '0 4px 12px rgba(0,0,0,0.15)',
              pointerEvents: 'auto',
              // 자동 사이즈 조절
              minHeight: 'fit-content',
              height: 'auto'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onKakaoPlaceClick(place);
            }}
            onMouseEnter={() => setSelectedKakaoIndex(index)}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {/* 번호 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '14px',
                height: '14px',
                fontSize: '8px',
                fontWeight: 'bold',
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff'
              }}>
                {index + 1}
              </div>
              
              {/* 장소 정보 */}
              <div style={{
                flex: 1,
                minWidth: 0
              }}>
                {/* 장소명 */}
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  marginBottom: '2px',
                  color: '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}>
                  {place.place_name}
                </div>
                
                {/* 주소 */}
                <div style={{
                  fontSize: '9px',
                  color: '#cccccc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}>
                  {place.road_address_name || place.address_name}
                </div>
              </div>

              {/* 선택 표시 */}
              {selectedKakaoIndex === index && (
                <div style={{
                  fontSize: '9px',
                  color: '#93c5fd',
                  fontWeight: '500',
                  flexShrink: 0
                }}>
                  선택됨
                </div>
              )}

              {Number.isFinite(Number(place.distance)) ? (
                <div style={{
                  fontSize: '8px',
                  color: '#999999',
                  lineHeight: 1.3,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}>
                  {Math.round(Number(place.distance))}m
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* 로딩 상태 - 다크 모드 */}
    {isKakaoLoading && (
      <div 
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          textAlign: 'center'
        }}
      >
        <div style={{
          fontSize: '11px',
          color: '#ffffff',
          fontWeight: '500'
        }}>검색 중...</div>
      </div>
    )}
  </div>
  );
}

export { InitialState, TypingState };

export default TypingState;
