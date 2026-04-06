import { useState, useEffect, useRef } from 'react';
import './scrollbar.css'; // 동글 스크롤바 스타일 import

// 입력 전 상태: 아무것도 표시 안 함
const InitialState = () => null;

// 입력 중 상태: 자동완성 + 상황 태그 하이라이트
const TypingState = ({ 
  kakaoResults, 
  isKakaoLoading, 
  matchedContexts, 
  onKakaoPlaceClick, 
  onContextTagClick,
  selectedKakaoIndex 
}) => (
  <div className="absolute top-full left-0 right-0 mt-2 z-40">
    {/* 상황 태그 하이라이트 - 다크 모드 */}
    {matchedContexts.length > 0 && (
      <div 
        style={{
          marginBottom: '8px',
          padding: '12px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontWeight: '500',
          marginBottom: '8px'
        }}>
          💡 상황별 추천
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          {matchedContexts.map((context) => (
            <button
              key={context.key}
              onClick={() => onContextTagClick(context.key, context.name)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: context.color.includes('red') 
                  ? 'rgba(239, 68, 68, 0.8)' 
                  : context.color.includes('blue') 
                  ? 'rgba(59, 130, 246, 0.8)'
                  : context.color.includes('green') 
                  ? 'rgba(34, 197, 94, 0.8)'
                  : context.color.includes('yellow') 
                  ? 'rgba(245, 158, 11, 0.8)'
                  : context.color.includes('purple') 
                  ? 'rgba(168, 85, 247, 0.8)'
                  : 'rgba(107, 114, 128, 0.8)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: '13px' }}>{context.icon}</span>
              <span>{context.name}</span>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* 장소명 자동완성 - 플로팅 한줄씩 (반응형) */}
    {kakaoResults.length > 0 && (
      <div 
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
        {/* 장소 리스트 - 플로팅 한줄씩 */}
        {kakaoResults.map((place, index) => (
          <div
            key={place.id}
            style={{
              position: 'relative',
              width: '100%',
              background: 'rgba(18, 18, 18, 0.7)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '8px 12px',
              marginBottom: index < kakaoResults.length - 1 ? '4px' : '0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              pointerEvents: 'auto',
              // 자동 사이즈 조절
              minHeight: 'fit-content',
              height: 'auto'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onKakaoPlaceClick(place);
            }}
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
                width: '16px',
                height: '16px',
                fontSize: '9px',
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
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '2px',
                  color: '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {place.place_name}
                </div>
                
                {/* 주소 */}
                <div style={{
                  fontSize: '10px',
                  color: '#cccccc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {place.road_address_name || place.address_name}
                </div>
              </div>
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
          fontSize: '13px',
          color: '#ffffff',
          fontWeight: '500'
        }}>검색 중...</div>
      </div>
    )}
  </div>
);

// 검색 후 상태: 필터 칩 - 다크 모드
const SearchCompleteState = ({ appliedFilters, onFilterRemove }) => (
  <div 
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
    }}
  >
    {appliedFilters.map((filter, index) => (
      <div
        key={index}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px',
          fontSize: '13px',
          color: '#ffffff',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
        onClick={() => onFilterRemove(index)}
      >
        <span>{filter.icon}</span>
        <span>{filter.label}</span>
        <button
          style={{
            marginLeft: '4px',
            color: 'rgba(255, 255, 255, 0.7)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.target.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.target.style.color = 'rgba(255, 255, 255, 0.7)';
          }}
        >
          ×
        </button>
      </div>
    ))}
  </div>
);

export { InitialState, TypingState, SearchCompleteState };
