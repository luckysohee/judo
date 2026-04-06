import React from 'react';

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
    {/* 상황 태그 하이라이트 */}
    {matchedContexts.length > 0 && (
      <div className="mb-2 p-3 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 ring-1 ring-black/5">
        <div className="text-xs text-gray-600 mb-2 font-medium">💡 상황별 추천</div>
        <div className="flex flex-wrap gap-2">
          {matchedContexts.map((context) => (
            <button
              key={context.key}
              onClick={() => onContextTagClick(context.key, context.name)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                text-white/90 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:shadow-md
                ${context.color.replace('bg-', 'bg/')} hover:${context.color.replace('bg-', 'bg/80')}
              `}
            >
              <span className="text-sm">{context.icon}</span>
              <span>{context.name}</span>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* 장소명 자동완성 */}
    {kakaoResults.length > 0 && (
      <div className="absolute top-full left-0 right-0 mt-0 w-full bg-black/85 backdrop-blur-2xl border border-white/30 rounded-b-lg shadow-2xl shadow-black/60 z-50">
        <div className="border-b border-white/20">
          <div className="px-4 py-2 bg-black/70 border-b border-white/20">
            <div className="text-xs font-medium text-white/90">📍 장소 검색 결과 ({kakaoResults.length}개)</div>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {kakaoResults.map((place, index) => (
            <div
              key={place.id}
              className={`
                w-full px-4 py-2 border-b border-white/15 last:border-b-0 transition-all duration-200 cursor-pointer
                ${selectedKakaoIndex === index 
                  ? 'bg-white/25 border-l-4 border-l-white/70 backdrop-blur-sm' 
                  : 'hover:bg-white/15 border-l-4 border-l-transparent hover:backdrop-blur-sm'
                }
              `}
              onClick={() => onKakaoPlaceClick(place)}
            >
              <div className="text-sm">
                <span className={`font-medium ${
                  selectedKakaoIndex === index ? 'text-white' : 'text-white/95'
                }`}>
                  {index + 1}. {place.place_name}
                </span>
                {place.road_address_name || place.address_name ? (
                  <span className="text-white/70 ml-2">
                    ({place.road_address_name || place.address_name})
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* 로딩 상태 */}
    {isKakaoLoading && (
      <div className="p-4 bg-white/80 backdrop-blur-md rounded-xl shadow-lg border border-white/20 ring-1 ring-black/5 text-center">
        <div className="text-sm text-gray-600">검색 중...</div>
      </div>
    )}
  </div>
);

// 검색 후 상태: 필터 칩
const SearchCompleteState = ({ appliedFilters, onFilterRemove }) => (
  <div className="flex flex-wrap gap-2 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30">
    {appliedFilters.map((filter, index) => (
      <div
        key={index}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/70 backdrop-blur-sm border border-white/40 rounded-full text-sm hover:bg-white/90 transition-all duration-200 hover:shadow-md"
      >
        <span>{filter.icon}</span>
        <span>{filter.label}</span>
        <button
          onClick={() => onFilterRemove(index)}
          className="ml-1 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full w-4 h-4 flex items-center justify-center transition-all duration-200"
        >
          ×
        </button>
      </div>
    ))}
  </div>
);

export { InitialState, TypingState, SearchCompleteState };
