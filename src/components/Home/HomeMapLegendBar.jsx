import MarkerLegend from "../Map/MarkerLegend";

/**
 * 지도 좌측 범례(`MarkerLegend`) + 우측 "내 위치" 버튼 묶음.
 * 저장만 보기 토글, 카테고리 필터, 내 위치 요청을 한 컴포넌트로 모아 Home의 JSX 잡음을 줄인다.
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
}) {
  return (
    <>
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
    </>
  );
}
