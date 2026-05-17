import { useState, useRef, useEffect } from "react";
import HotCheckinStrip from "./HotCheckinStrip";
import HomeSearchAboveStrip from "./HomeSearchAboveStrip";

/**
 * 스와이프 가능한 홈 시트 컴포넌트
 * - 시트 1: 오늘 한잔 TOP 등 (미사용 레일아웃 예시)
 * - 시트 2: 취향 탐색 (미사용)
 * 실제 홈은 `HotCheckinStrip` 탭에 `HomeCourseRail` 이 포함됨.
 */
export default function SwipeableHomeSheets({
  // HotCheckinStrip props
  rankingTop5 = [],
  risingCurators = [],
  placesOnMap = [],
  mapRef,
  onPickPlace,
  onPickCurator,
  user = null,
  onOpenMutualPlaceDetail,
  onPickMutualUser,
  onMutualSearchOpenChange,
  hideWhenPreviewOpen = false,
  hideWhenSearchActive = false,
  judoMode = null,
  
  // HomeSearchAboveStrip props
  idleHintVisible = false,
  idleHintText = "",
  idleHintStyle = {},
  showCollectionsRail = false,
  showSpotlight = false,
  spotlightPlaces = [],
  onPickSpotlightPlace,
  onPickSituationSearchPreset,
}) {
  const [currentSheet, setCurrentSheet] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const containerRef = useRef(null);

  const sheets = [
    {
      id: "hot-checkin",
      title: "오늘 한잔 TOP",
      component: (
        <HotCheckinStrip
          rankingTop5={rankingTop5}
          risingCurators={risingCurators}
          placesOnMap={placesOnMap}
          mapRef={mapRef}
          onPickPlace={onPickPlace}
          onPickCurator={onPickCurator}
          user={user}
          onOpenMutualPlaceDetail={onOpenMutualPlaceDetail}
          onPickMutualUser={onPickMutualUser}
          onMutualSearchOpenChange={onMutualSearchOpenChange}
          hideWhenPreviewOpen={hideWhenPreviewOpen}
          hideWhenSearchActive={hideWhenSearchActive}
          judoMode={judoMode}
        />
      ),
    },
    {
      id: "social-search",
      title: "취향 탐색",
      component: (
        <HomeSearchAboveStrip
          idleHintVisible={idleHintVisible}
          idleHintText={idleHintText}
          idleHintStyle={idleHintStyle}
          showCollectionsRail={showCollectionsRail}
          showSpotlight={showSpotlight}
          spotlightPlaces={spotlightPlaces}
          onPickSpotlightPlace={onPickSpotlightPlace}
          onPickSituationSearchPreset={onPickSituationSearchPreset}
        />
      ),
    },
  ];

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setTranslateX(0);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    
    // 스와이프 제한 (최대 100px)
    const maxSwipe = 100;
    const clampedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
    
    setTranslateX(clampedDiff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const swipeThreshold = 50;
    
    if (translateX > swipeThreshold && currentSheet > 0) {
      // 오른쪽으로 스와이프 -> 이전 시트
      setCurrentSheet(currentSheet - 1);
    } else if (translateX < -swipeThreshold && currentSheet < sheets.length - 1) {
      // 왼쪽으로 스와이프 -> 다음 시트
      setCurrentSheet(currentSheet + 1);
    }
    
    setIsDragging(false);
    setTranslateX(0);
  };

  const handleSheetIndicatorClick = (index) => {
    setCurrentSheet(index);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        handleTouchEnd();
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging, translateX, currentSheet]);

  const styles = {
    container: {
      position: "relative",
      width: "100%",
      height: "auto",
      overflow: "hidden",
      touchAction: "pan-y",
    },
    sheetsWrapper: {
      display: "flex",
      transition: isDragging ? "none" : "transform 0.3s ease-out",
      transform: `translateX(${-currentSheet * 100 + translateX * 0.3}%)`,
      width: `${sheets.length * 100}%`,
    },
    sheet: {
      width: "100%",
      flexShrink: 0,
    },
    indicators: {
      position: "absolute",
      bottom: "8px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "8px",
      zIndex: 100,
    },
    indicator: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: currentSheet === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
      cursor: "pointer",
      transition: "all 0.2s ease",
    },
    indicatorActive: {
      background: "rgba(255,255,255,0.9)",
    },
    sheetTitle: {
      position: "absolute",
      top: "8px",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "12px",
      fontWeight: 600,
      color: "rgba(255,255,255,0.8)",
      background: "rgba(0,0,0,0.3)",
      padding: "4px 8px",
      borderRadius: "12px",
      zIndex: 100,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.sheetTitle}>
        {sheets[currentSheet].title}
      </div>
      
      <div
        ref={containerRef}
        style={styles.sheetsWrapper}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {sheets.map((sheet) => (
          <div key={sheet.id} style={styles.sheet}>
            {sheet.component}
          </div>
        ))}
      </div>

      <div style={styles.indicators}>
        {sheets.map((_, index) => (
          <button
            key={index}
            style={{
              ...styles.indicator,
              ...(currentSheet === index ? styles.indicatorActive : {}),
            }}
            onClick={() => handleSheetIndicatorClick(index)}
            aria-label={`시트 ${index + 1}로 이동`}
          />
        ))}
      </div>
    </div>
  );
}
