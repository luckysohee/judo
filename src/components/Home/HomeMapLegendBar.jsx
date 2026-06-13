import MarkerLegend from "../Map/MarkerLegend";

/**
 * 지도 좌측 범례(`MarkerLegend`) + 우측 "내 위치" 버튼 묶음.
 * 별 = 내가 폴더에 저장한 장소 / 마커 안내 3종 = 다른 큐레이터 추천 등급(단일·공동·프리미엄).
 */
export default function HomeMapLegendBar({
  mapCloseTick,
  savedOnly,
  onToggleSavedOnly,
  activeCategory,
  closeSignal,
  onSelectCategory,
  onRequestMyLocation,
  mapLocationLoading,
  myLocationButtonStyle,
  myLocationSpinnerStyle,
  stackStyle,
}) {
  return (
    <div style={stackStyle}>
      <MarkerLegend
        mapCloseTick={mapCloseTick}
        savedOnly={savedOnly}
        onToggleSavedOnly={onToggleSavedOnly}
        activeCategory={activeCategory}
        closeSignal={closeSignal}
        onSelectCategory={onSelectCategory}
      />
      <button
        type="button"
        onClick={onRequestMyLocation}
        disabled={mapLocationLoading}
        style={{
          ...myLocationButtonStyle,
          opacity: mapLocationLoading ? 0.72 : 1,
        }}
        title="내 위치"
        aria-label="내 위치로 이동"
      >
        {mapLocationLoading ? (
          <span style={myLocationSpinnerStyle} aria-hidden />
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
  );
}
