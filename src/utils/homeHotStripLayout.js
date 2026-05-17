/** 홈 `HotCheckinStrip` — 검색바 위 여백(px) */
export const HOME_HOT_STRIP_NAV_CLEARANCE_PX = 108;

/** 코스 탭 — 검색바 숨김 시 시트 하단(`Home` `bottomBarContainer` bottom과 동일) */
export const HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX = 18;

/** 탭 한 줄 높이 */
export const HOME_HOT_STRIP_TAB_ROW_PX = 28;

/** 탭 아래 콘텐츠 슬롯(모든 탭 동일 — 탭 위치 고정) */
export const HOME_HOT_STRIP_CONTENT_SLOT_PX = 76;

/** 바 세로 패딩 합(상·하 각 6px) */
export const HOME_HOT_STRIP_BAR_PAD_V_PX = 12;

/** 탭 행 ↔ 슬롯 사이 gap */
export const HOME_HOT_STRIP_TAB_GAP_PX = 6;

/** 플로팅 스트립 상단 — 탭 Y 고정(코스 탭 아래 확장 시에도 동일) */
export function homeHotStripWrapTopCss() {
  return `calc(100dvh - ${HOME_HOT_STRIP_NAV_CLEARANCE_PX + homeHotStripBarHeightPx()}px - env(safe-area-inset-bottom, 0px))`;
}

/** 코스 탭 시트 하단 — 빈 검색바 구간까지 채움 */
export function homeHotStripCoursesWrapBottomCss() {
  return `calc(${HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX}px + env(safe-area-inset-bottom, 0px))`;
}

/** 코스 탭·도장 바텀시트 공통 높이(px) — top/bottom 앵커 간 거리 */
export function homeHotStripCoursesSheetHeightPx() {
  return (
    HOME_HOT_STRIP_NAV_CLEARANCE_PX +
    homeHotStripBarHeightPx() -
    HOME_HOT_STRIP_COURSES_DOCK_BOTTOM_PX
  );
}

/** 플로팅 스트립 전체 높이(탭+슬롯+패딩) */
export function homeHotStripBarHeightPx() {
  return (
    HOME_HOT_STRIP_BAR_PAD_V_PX +
    HOME_HOT_STRIP_TAB_ROW_PX +
    HOME_HOT_STRIP_TAB_GAP_PX +
    HOME_HOT_STRIP_CONTENT_SLOT_PX
  );
}

/** 뷰포트 하단 기준 — 탭 행 아래쪽 가장자리(px) */
export function homeHotStripTabRowBottomPx() {
  return (
    HOME_HOT_STRIP_NAV_CLEARANCE_PX +
    6 +
    HOME_HOT_STRIP_CONTENT_SLOT_PX +
    HOME_HOT_STRIP_TAB_GAP_PX
  );
}

/** 술 상황 칩 — 스트립 위 */
export function homeDrinksSituationStripBottomCss() {
  return `calc(${HOME_HOT_STRIP_NAV_CLEARANCE_PX}px + ${homeHotStripBarHeightPx()}px + 8px + env(safe-area-inset-bottom, 0px))`;
}
